import 'regenerator-runtime/runtime';
import fs from 'node:fs';
import path from 'node:path';
import {
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFPage,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { OrganizationSettings, ReportPayload } from './types';
import { calculateFees, formatINR, numberToIndianWords } from './fee-calculator';
import { formatDisplayDate, replacePlaceholders } from './text-utils';
import { DEFAULT_ORGANIZATION_SETTINGS } from './default-data';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_LEFT = 46;
const MARGIN_RIGHT = 46;
const MARGIN_TOP = 32;
const MARGIN_BOTTOM = 38;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

interface FontBundle {
  latinRegular: PDFFont;
  latinBold: PDFFont;
  latinItalic: PDFFont;
  devRegular: PDFFont;
  devBold: PDFFont;
}

interface TextSegment {
  text: string;
  bold: boolean;
  underline: boolean;
  isDevanagari: boolean;
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return rgb(0.08, 0.18, 0.33);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Splits text into inline styled runs (**bold**, __underline__) and further splits
 * Latin/common characters vs Devanagari characters so every Unicode code point renders cleanly.
 */
function tokenizeStyledText(raw: string, baseBold = false, baseUnderline = false): TextSegment[] {
  const segments: TextSegment[] = [];
  const styleRegex = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const pushScriptRuns = (str: string, bold: boolean, underline: boolean) => {
    const scriptRegex = /([\u0900-\u097F\u200C\u200D]+|[^\u0900-\u097F\u200C\u200D]+)/g;
    let m: RegExpExecArray | null;
    while ((m = scriptRegex.exec(str)) !== null) {
      const part = m[0];
      if (!part) continue;
      const isDevanagari = /[\u0900-\u097F]/.test(part);
      segments.push({ text: part, bold, underline, isDevanagari });
    }
  };

  while ((match = styleRegex.exec(raw)) !== null) {
    if (match.index > lastIdx) {
      pushScriptRuns(raw.slice(lastIdx, match.index), baseBold, baseUnderline);
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      pushScriptRuns(token.slice(2, -2), true, baseUnderline);
    } else if (token.startsWith('__') && token.endsWith('__')) {
      pushScriptRuns(token.slice(2, -2), baseBold, true);
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < raw.length) {
    pushScriptRuns(raw.slice(lastIdx), baseBold, baseUnderline);
  }

  return segments;
}

function getFontForSegment(seg: TextSegment, fonts: FontBundle): PDFFont {
  if (seg.isDevanagari) {
    return seg.bold ? fonts.devBold : fonts.devRegular;
  }
  return seg.bold ? fonts.latinBold : fonts.latinRegular;
}

function measureShapedWidth(text: string, size: number, font: PDFFont): number {
  const embedder = (font as unknown as {
    embedder?: { font?: { layout: (t: string) => { positions: { xAdvance: number }[] }; unitsPerEm: number } };
  }).embedder;
  if (!embedder?.font) return font.widthOfTextAtSize(text, size);
  const layout = embedder.font.layout(text);
  const scale = size / embedder.font.unitsPerEm;
  return layout.positions.reduce((acc, p) => acc + p.xAdvance * scale, 0);
}

function measureStyledText(
  text: string,
  size: number,
  fonts: FontBundle,
  baseBold = false
): number {
  const segs = tokenizeStyledText(text, baseBold, false);
  let width = 0;
  for (const s of segs) {
    const f = getFontForSegment(s, fonts);
    width += s.isDevanagari ? measureShapedWidth(s.text, size, f) : f.widthOfTextAtSize(s.text, size);
  }
  return width;
}

function drawShapedDevanagari(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): number {
  const embedder = (font as unknown as {
    embedder?: {
      font?: {
        layout: (t: string) => {
          glyphs: { id: number }[];
          positions: { xAdvance: number; xOffset: number; yOffset: number }[];
        };
        unitsPerEm: number;
      };
    };
  }).embedder;

  if (!embedder?.font) {
    page.drawText(text, { x, y, size, font, color });
    return font.widthOfTextAtSize(text, size);
  }

  // Register glyphs into the PDF subsetter before emitting raw glyph hex codes
  font.encodeText(text);
  const layout = embedder.font.layout(text);
  const scale = size / embedder.font.unitsPerEm;
  const fontKey = (
    page.node as unknown as { newFontDictionary: (n: string, r: unknown) => string }
  ).newFontDictionary(font.name, font.ref);

  let cx = x;
  const ops = [pushGraphicsState(), setFillingColor(color), setFontAndSize(fontKey, size)];
  for (let i = 0; i < layout.glyphs.length; i++) {
    const g = layout.glyphs[i];
    const p = layout.positions[i];
    const gx = cx + p.xOffset * scale;
    const gy = y + p.yOffset * scale;
    const hex = g.id.toString(16).toUpperCase().padStart(4, '0');
    ops.push(
      beginText(),
      setTextMatrix(1, 0, 0, 1, gx, gy),
      showText(PDFHexString.of(hex)),
      endText()
    );
    cx += p.xAdvance * scale;
  }
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
  return cx - x;
}

function drawStyledText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: FontBundle,
  color = rgb(0.09, 0.09, 0.09),
  baseBold = false,
  baseUnderline = false
): number {
  const segs = tokenizeStyledText(text, baseBold, baseUnderline);
  let cursorX = x;
  for (const s of segs) {
    const f = getFontForSegment(s, fonts);
    let w: number;
    if (s.isDevanagari) {
      w = drawShapedDevanagari(page, s.text, cursorX, y, size, f, color);
    } else {
      w = f.widthOfTextAtSize(s.text, size);
      page.drawText(s.text, {
        x: cursorX,
        y,
        size,
        font: f,
        color,
      });
    }
    if (s.underline && w > 0) {
      page.drawLine({
        start: { x: cursorX, y: y - 1.5 },
        end: { x: cursorX + w, y: y - 1.5 },
        thickness: Math.max(0.6, size * 0.07),
        color,
      });
    }
    cursorX += w;
  }
  return cursorX - x;
}

interface WrappedLine {
  words: { text: string; width: number }[];
  isLastInParagraph: boolean;
}

function wrapStyledParagraph(
  paragraph: string,
  maxWidth: number,
  fontSize: number,
  fonts: FontBundle,
  baseBold = false
): WrappedLine[] {
  const cleaned = paragraph.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // Split by spaces while preserving bold/underline tokens spanning multiple words
  const tokens = splitPreservingInlineTokens(cleaned);
  const spaceWidth = fonts.latinRegular.widthOfTextAtSize(' ', fontSize);
  const lines: WrappedLine[] = [];
  let currentWords: { text: string; width: number }[] = [];
  let currentWidth = 0;

  for (const word of tokens) {
    const w = measureStyledText(word, fontSize, fonts, baseBold);
    const added = currentWords.length === 0 ? w : spaceWidth + w;
    if (currentWords.length > 0 && currentWidth + added > maxWidth) {
      lines.push({ words: currentWords, isLastInParagraph: false });
      currentWords = [{ text: word, width: w }];
      currentWidth = w;
    } else {
      currentWords.push({ text: word, width: w });
      currentWidth += added;
    }
  }
  if (currentWords.length > 0) {
    lines.push({ words: currentWords, isLastInParagraph: true });
  }
  return lines;
}

function splitPreservingInlineTokens(text: string): string[] {
  const result: string[] = [];
  const styleRegex = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (str: string) => {
    for (const part of str.split(' ')) {
      if (part) result.push(part);
    }
  };

  while ((match = styleRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      pushPlain(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    const wrapper = token.slice(0, 2);
    const inner = token.slice(2, -2).trim();
    for (const word of inner.split(' ')) {
      if (word) result.push(`${wrapper}${word}${wrapper}`);
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    pushPlain(text.slice(lastIdx));
  }
  return result;
}

function drawWrappedLines(
  page: PDFPage,
  lines: WrappedLine[],
  x: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  fonts: FontBundle,
  color = rgb(0.09, 0.09, 0.09),
  justify = true
): number {
  let y = startY;
  const defaultSpace = fonts.latinRegular.widthOfTextAtSize(' ', fontSize);

  for (const line of lines) {
    const wordsWidth = line.words.reduce((sum, w) => sum + w.width, 0);
    const gaps = line.words.length - 1;
    let space = defaultSpace;

    if (justify && !line.isLastInParagraph && gaps > 0) {
      const candidateSpace = (maxWidth - wordsWidth) / gaps;
      if (candidateSpace > defaultSpace * 0.7 && candidateSpace < defaultSpace * 2.6) {
        space = candidateSpace;
      }
    }

    let cursorX = x;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      drawStyledText(page, w.text, cursorX, y, fontSize, fonts, color);
      cursorX += w.width + (i < gaps ? space : 0);
    }
    y -= lineHeight;
  }
  return y;
}

function loadFontBytes(filename: string): Uint8Array {
  const fullPath = path.join(process.cwd(), 'public', 'fonts', filename);
  return fs.readFileSync(fullPath);
}

export interface GeneratedPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  autoCompressed: boolean;
}

export async function generateAdvisoryPdf(
  report: ReportPayload,
  orgSettings: OrganizationSettings = DEFAULT_ORGANIZATION_SETTINGS
): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fonts: FontBundle = {
    latinRegular: await pdfDoc.embedFont(loadFontBytes('NotoSans-Regular.ttf')),
    latinBold: await pdfDoc.embedFont(loadFontBytes('NotoSans-Bold.ttf')),
    latinItalic: await pdfDoc.embedFont(loadFontBytes('LiberationSans-Italic.ttf')),
    devRegular: await pdfDoc.embedFont(loadFontBytes('NotoSansDevanagari-Regular.ttf')),
    devBold: await pdfDoc.embedFont(loadFontBytes('NotoSansDevanagari-Bold.ttf')),
  };

  pdfDoc.setTitle(`${report.brandName || 'Trademark'} - Private Trademark Advisory Report`);
  pdfDoc.setAuthor(report.preparedBy || orgSettings.organizationName);
  pdfDoc.setSubject('Private Trademark Examination & Section 11 Advisory Report');
  pdfDoc.setKeywords(['Trademark', 'Section 11', 'Advisory', report.brandName, report.applicationNumber]);
  pdfDoc.setCreator('Legal Success India PDF Engine');

  let headerBannerImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (orgSettings.headerBannerImage && orgSettings.headerBannerImage.startsWith('data:image/')) {
    try {
      const match = orgSettings.headerBannerImage.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (match) {
        const imgBytes = Buffer.from(match[2], 'base64');
        headerBannerImg =
          match[1].toLowerCase() === 'png'
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes);
      }
    } catch {
      headerBannerImg = null;
    }
  }

  const primaryColor = hexToRgb(report.styling?.primaryColor || orgSettings.primaryColor || '#142F55');
  const accentColor = hexToRgb(report.styling?.accentColor || orgSettings.accentColor || '#B8A16A');
  const darkInk = rgb(0.07, 0.07, 0.07);
  const mutedInk = rgb(0.38, 0.38, 0.38);

  const feeSummary = calculateFees(report.fees);
  const isFillable = report.styling?.exportMode === 'fillable';
  const form = isFillable ? pdfDoc.getForm() : null;

  // Attempt single-page fit by measuring first, then choosing scale/spacing tier
  const renderWithScale = (
    tier: 'normal' | 'compact' | 'tight',
    dryRun: boolean
  ): { pageCount: number; pages: PDFPage[] } => {
    const bodySizeBase = report.styling?.bodyFontSize || 9;
    const bodySize =
      tier === 'normal' ? bodySizeBase : tier === 'compact' ? Math.max(8.3, bodySizeBase - 0.5) : Math.max(7.9, bodySizeBase - 0.9);
    const lineMult =
      tier === 'normal'
        ? report.styling?.lineSpacing || 1.2
        : tier === 'compact'
          ? 1.13
          : 1.08;
    const lineHeight = bodySize * lineMult;
    const metaRowHeight = tier === 'normal' ? 13.5 : tier === 'compact' ? 12.2 : 11.4;
    const sectionGap = tier === 'normal' ? 8 : tier === 'compact' ? 5.5 : 4;
    const paraGap = tier === 'normal' ? 4.5 : tier === 'compact' ? 3 : 2.2;

    const pages: PDFPage[] = [];
    const addNewPage = () => {
      const p = dryRun ? (null as unknown as PDFPage) : pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      pages.push(p);
      return p;
    };

    let page = addNewPage();
    let y = A4_HEIGHT - MARGIN_TOP;

    const minContentY = MARGIN_BOTTOM + 68; // Reserve room for disclaimer + footer

    const ensureSpace = (neededHeight: number) => {
      if (y - neededHeight < minContentY) {
        page = addNewPage();
        y = A4_HEIGHT - MARGIN_TOP;
        // Draw slim continuation header on page 2+
        if (!dryRun) {
          drawStyledText(
            page,
            `${orgSettings.organizationName} · ${report.brandName} (${report.applicationNumber})`,
            MARGIN_LEFT,
            y - 10,
            8,
            fonts,
            mutedInk,
            true
          );
          page.drawLine({
            start: { x: MARGIN_LEFT, y: y - 16 },
            end: { x: A4_WIDTH - MARGIN_RIGHT, y: y - 16 },
            thickness: 0.6,
            color: rgb(0.8, 0.84, 0.88),
          });
        }
        y -= 28;
      }
    };

    // 1. HEADER SECTION
    const headerHeight = tier === 'normal' ? 56 : 50;
    if (!dryRun) {
      const headerLineY = y - headerHeight + 6;
      const refY = headerLineY + 4;
      const dateY = headerLineY + 15;

      const headerLeftText = (report.headerLeftText ?? 'From: Legal Success India').trim();
      if (isFillable && form) {
        const ltf = form.createTextField('header_left_text');
        ltf.setText(headerLeftText);
        ltf.addToPage(page, {
          x: MARGIN_LEFT,
          y: headerLineY + 2.5,
          width: 175,
          height: 14,
          borderWidth: 0.4,
          borderColor: rgb(0.75, 0.8, 0.86),
          font: fonts.latinBold,
        });
        ltf.setFontSize(8.5);
      } else if (headerLeftText) {
        const leftMaxW = 185;
        let leftSize = 8.5;
        while (leftSize > 7.2 && measureStyledText(headerLeftText, leftSize, fonts, true) > leftMaxW) {
          leftSize -= 0.3;
        }
        if (measureStyledText(headerLeftText, leftSize, fonts, true) <= leftMaxW) {
          drawStyledText(page, headerLeftText, MARGIN_LEFT, refY, leftSize, fonts, darkInk, true);
        } else {
          const wrapped = wrapStyledParagraph(headerLeftText, leftMaxW, leftSize, fonts, true).slice(0, 2);
          const lh = leftSize * 1.15;
          let ly = refY + (wrapped.length - 1) * lh;
          for (const line of wrapped) {
            let cx = MARGIN_LEFT;
            const sp = fonts.latinBold.widthOfTextAtSize(' ', leftSize);
            for (const w of line.words) {
              drawStyledText(page, w.text, cx, ly, leftSize, fonts, darkInk, true);
              cx += w.width + sp;
            }
            ly -= lh;
          }
        }
      }

      if (headerBannerImg) {
        const maxW = 190;
        const maxH = headerHeight - 10;
        const ratio = Math.min(maxW / headerBannerImg.width, maxH / headerBannerImg.height);
        const drawW = headerBannerImg.width * ratio;
        const drawH = headerBannerImg.height * ratio;
        page.drawImage(headerBannerImg, {
          x: A4_WIDTH / 2 - drawW / 2,
          y: headerLineY + 4 + (maxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }

      const dateStr = `DATE : ${formatDisplayDate(report.documentDate)}`;
      if (isFillable && form) {
        const label = 'DATE : ';
        const lw = measureStyledText(label, 9.5, fonts, true);
        const fieldW = 72;
        drawStyledText(
          page,
          label,
          A4_WIDTH - MARGIN_RIGHT - fieldW - lw,
          dateY,
          9.5,
          fonts,
          darkInk,
          true
        );
        const tf = form.createTextField('document_date');
        tf.setText(formatDisplayDate(report.documentDate));
        tf.addToPage(page, {
          x: A4_WIDTH - MARGIN_RIGHT - fieldW,
          y: dateY - 2,
          width: fieldW,
          height: 13,
          borderWidth: 0.5,
          borderColor: rgb(0.75, 0.8, 0.86),
          font: fonts.latinBold,
        });
        tf.setFontSize(9);
      } else {
        const dateW = measureStyledText(dateStr, 9.5, fonts, true);
        drawStyledText(
          page,
          dateStr,
          A4_WIDTH - MARGIN_RIGHT - dateW,
          dateY,
          9.5,
          fonts,
          darkInk,
          true
        );
      }

      // Ref ID anchored right above the bottom header line
      const refStr = `Ref: ${report.reportReferenceNumber}`;
      const refW = measureStyledText(refStr, 7.5, fonts, false);
      drawStyledText(page, refStr, A4_WIDTH - MARGIN_RIGHT - refW, refY, 7.5, fonts, mutedInk);

      // Header bottom navy divider
      page.drawLine({
        start: { x: MARGIN_LEFT, y: headerLineY },
        end: { x: A4_WIDTH - MARGIN_RIGHT, y: headerLineY },
        thickness: 1.1,
        color: primaryColor,
      });
    }
    y -= headerHeight + (tier === 'normal' ? 4 : 2);

    // 2. APPLICATION INFORMATION BLOCK
    const includeHindi = report.styling?.includeHindiLabels !== false;
    const l = (hi: string, en: string) => (includeHindi ? `${hi}/${en}:` : `${en}:`);

    const primaryEarlier = report.earlierTrademarks[0];
    const earlierNames =
      report.earlierTrademarks
        .map((m) => m.markName.trim())
        .filter(Boolean)
        .join('; ') || 'N/A';
    const earlierNos =
      report.earlierTrademarks
        .map((m) => m.applicationNumber.trim())
        .filter(Boolean)
        .join('; ') || 'N/A';

    const recipientText = [report.applicantName, report.organizationName]
      .filter((s) => s && s.trim().length > 0)
      .join(' — ') || 'Dear Proprietor';

    const chargesSummaryText =
      feeSummary.governmentFee > 0
        ? `${formatINR(feeSummary.totalPayable)} (Prof. ${formatINR(feeSummary.professionalFee, false)} + Govt. ${formatINR(feeSummary.governmentFee, false)})`
        : `${formatINR(feeSummary.totalPayable)} (${numberToIndianWords(feeSummary.totalPayable)})`;

    interface MetaRow {
      label: string;
      value: string;
      valueBold?: boolean;
      valueSize?: number;
      fieldName?: string;
    }

    const metaRows: MetaRow[] = [
      { label: 'From:', value: report.preparedBy || 'Legal Success India', valueBold: true },
      {
        label: includeHindi ? 'सेवा में / To:' : 'To / Applicant:',
        value: recipientText,
        fieldName: 'applicant_name',
      },
      {
        label: l('ब्रांड नाम', 'Brand Name'),
        value: report.brandName || '',
        valueBold: true,
        valueSize: tier === 'normal' ? 11.5 : 10.5,
        fieldName: 'brand_name',
      },
      {
        label: l('ट्रेडमार्क आवेदन संख्या', 'Trademark Application No.'),
        value: report.applicationNumber || '',
        valueBold: true,
        fieldName: 'application_number',
      },
      ...(report.trademarkClass
        ? [
            {
              label: l('ट्रेडमार्क वर्ग', 'Trademark Class'),
              value: report.trademarkClass,
              fieldName: 'trademark_class',
            },
          ]
        : []),
      {
        label: l('लागू प्रावधान', 'Applicable Provision'),
        value: report.applicationProvision,
        valueBold: true,
      },
      {
        label: l('वर्तमान स्थिति', 'Current Status'),
        value: report.currentStatus,
        fieldName: 'current_status',
      },
      { label: l('विषय', 'Subject'), value: report.subject },
      { label: l('प्रक्रिया', 'Process'), value: report.examinationProcess },
      { label: l('लागू क्षेत्राधिकार', 'Applicable Jurisdiction'), value: report.applicableJurisdiction },
      {
        label: l('पूर्व पंजीकृत ट्रेडमार्क', 'Earlier Registered Trademark'),
        value: earlierNames,
        valueBold: true,
        fieldName: 'earlier_trademark',
      },
      {
        label: l('पूर्व आवेदन संख्या', 'Earlier Application No.'),
        value: earlierNos,
        valueBold: true,
        fieldName: 'earlier_application_number',
      },
      {
        label: l('सेवा शुल्क', 'Applicable Charges'),
        value: chargesSummaryText,
        valueBold: true,
        fieldName: 'applicable_charges',
      },
      {
        label: l('भुगतान मोड', 'Payment Mode'),
        value: report.fees.paymentMode || orgSettings.defaultPaymentMode,
      },
    ];

    const boxPaddingTop = 6;
    const boxPaddingBottom = 5;
    const metaBoxHeight = boxPaddingTop + metaRows.length * metaRowHeight + boxPaddingBottom;

    if (!dryRun) {
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: y - metaBoxHeight,
        width: CONTENT_WIDTH,
        height: metaBoxHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.84, 0.86, 0.9),
        borderWidth: 0.6,
      });

      let rowY = y - boxPaddingTop - 9;
      const labelColX = MARGIN_LEFT + 8;
      const valueColX = MARGIN_LEFT + 225;
      const valueMaxWidth = CONTENT_WIDTH - 233;

      for (const row of metaRows) {
        drawStyledText(page, row.label, labelColX, rowY, 7.8, fonts, darkInk, true);

        if (isFillable && form && row.fieldName) {
          const tf = form.createTextField(row.fieldName);
          tf.setText(row.value);
          tf.addToPage(page, {
            x: valueColX,
            y: rowY - 2.5,
            width: Math.min(285, valueMaxWidth),
            height: metaRowHeight - 1.5,
            borderWidth: 0.35,
            borderColor: rgb(0.8, 0.84, 0.88),
            font: row.valueBold ? fonts.latinBold : fonts.latinRegular,
          });
          tf.setFontSize(row.valueSize ? Math.min(10, row.valueSize) : 8.2);
        } else {
          const valSize = row.valueSize || 8.3;
          // Truncate cleanly if overly long for single metadata line
          let displayVal = row.value;
          while (
            displayVal.length > 8 &&
            measureStyledText(displayVal, valSize, fonts, Boolean(row.valueBold)) > valueMaxWidth
          ) {
            displayVal = displayVal.slice(0, -4) + '...';
          }
          drawStyledText(
            page,
            displayVal,
            valueColX,
            rowY,
            valSize,
            fonts,
            row.valueSize ? rgb(0, 0, 0) : darkInk,
            Boolean(row.valueBold)
          );
        }
        rowY -= metaRowHeight;
      }
    }

    y -= metaBoxHeight + (tier === 'normal' ? 10 : 7);

    // 3. MAIN DOCUMENT HEADING + DOUBLE HORIZONTAL LINE
    const rawHeading = report.heading.uppercase
      ? report.heading.text.toUpperCase()
      : report.heading.text;
    let headingSize = tier === 'normal' ? report.heading.fontSize : Math.min(16.5, report.heading.fontSize);
    while (
      headingSize > 11 &&
      measureStyledText(rawHeading, headingSize, fonts, report.heading.bold) > CONTENT_WIDTH
    ) {
      headingSize -= 0.5;
    }

    ensureSpace(34);
    if (!dryRun) {
      const hWidth = measureStyledText(rawHeading, headingSize, fonts, report.heading.bold);
      const hx =
        report.heading.alignment === 'center'
          ? MARGIN_LEFT + (CONTENT_WIDTH - hWidth) / 2
          : MARGIN_LEFT;
      drawStyledText(page, rawHeading, hx, y - headingSize + 2, headingSize, fonts, darkInk, report.heading.bold);

      if (report.heading.underline) {
        const lineY1 = y - headingSize - 3;
        const lineY2 = lineY1 - 2.6;
        page.drawLine({
          start: { x: MARGIN_LEFT, y: lineY1 },
          end: { x: A4_WIDTH - MARGIN_RIGHT, y: lineY1 },
          thickness: 1.5,
          color: primaryColor,
        });
        page.drawLine({
          start: { x: MARGIN_LEFT, y: lineY2 },
          end: { x: A4_WIDTH - MARGIN_RIGHT, y: lineY2 },
          thickness: 0.7,
          color: primaryColor,
        });
      }
    }
    y -= headingSize + (report.heading.underline ? 13 : 8);

    // 4. OPENING SALUTATION & PARAGRAPHS
    ensureSpace(lineHeight * 3);
    if (!dryRun && report.salutation.trim()) {
      drawStyledText(page, report.salutation, MARGIN_LEFT, y - bodySize, bodySize + 0.3, fonts, darkInk, true);
    }
    y -= lineHeight + 2;

    for (const para of report.openingParagraphs) {
      const resolved = replacePlaceholders(para, report);
      if (!resolved.trim()) continue;
      const lines = wrapStyledParagraph(resolved, CONTENT_WIDTH, bodySize, fonts);
      ensureSpace(lines.length * lineHeight + paraGap);
      if (!dryRun) {
        drawWrappedLines(page, lines, MARGIN_LEFT, y - bodySize, CONTENT_WIDTH, bodySize, lineHeight, fonts, darkInk, true);
      }
      y -= lines.length * lineHeight + paraGap;
    }

    // 5. APPLICATION & EARLIER MARK COMPACT SUMMARY BLOCK
    const summaryRows: { label: string; value: string }[] = [
      { label: 'Applied Trademark:', value: report.brandName },
      { label: 'Trademark Application No.:', value: report.applicationNumber },
    ];
    report.earlierTrademarks.forEach((em, idx) => {
      const suffix = report.earlierTrademarks.length > 1 ? ` (${idx + 1})` : '';
      summaryRows.push({
        label: `Earlier Registered Trademark${suffix}:`,
        value: em.markName || 'N/A',
      });
      summaryRows.push({
        label: `Earlier Application No.${suffix}:`,
        value: `${em.applicationNumber || 'N/A'}${em.status ? ` (${em.status})` : ''}`,
      });
    });

    ensureSpace(summaryRows.length * (lineHeight - 0.5) + 8);
    if (!dryRun) {
      for (const sr of summaryRows) {
        drawStyledText(page, sr.label, MARGIN_LEFT, y - bodySize, bodySize, fonts, darkInk, true);
        drawStyledText(page, sr.value, MARGIN_LEFT + 175, y - bodySize, bodySize, fonts, darkInk, true);
        y -= lineHeight - 0.5;
      }
    } else {
      y -= summaryRows.length * (lineHeight - 0.5);
    }
    y -= sectionGap;

    // 6. NUMBERED LEGAL SECTIONS
    for (const sec of report.sections) {
      const headingLine = `${sec.number}. ${replacePlaceholders(sec.title, report)}`;
      const secHeadSize = Math.min(11, bodySize + 1.5);

      ensureSpace(secHeadSize + lineHeight * 2 + 6);
      if (!dryRun) {
        drawStyledText(
          page,
          headingLine,
          MARGIN_LEFT,
          y - secHeadSize,
          secHeadSize,
          fonts,
          darkInk,
          true,
          sec.underlineHeading
        );
      }
      y -= secHeadSize + 5;

      // If this is the Fee Section, render prominent service fee & breakdown
      if (sec.isFeeSection) {
        const mainFeeText = `Applicable Service Charges: ${formatINR(feeSummary.totalPayable)} (${numberToIndianWords(feeSummary.totalPayable)})`;
        const feeSize = Math.min(12.2, bodySize + 2.8);
        const feeLines = wrapStyledParagraph(mainFeeText, CONTENT_WIDTH, feeSize, fonts, true);
        ensureSpace(feeLines.length * (feeSize * 1.2) + 18);
        if (!dryRun) {
          for (const fl of feeLines) {
            let cx = MARGIN_LEFT;
            for (const w of fl.words) {
              drawStyledText(page, w.text, cx, y - feeSize, feeSize, fonts, primaryColor, true);
              cx += w.width + fonts.latinBold.widthOfTextAtSize(' ', feeSize);
            }
            y -= feeSize * 1.22;
          }
        } else {
          y -= feeLines.length * (feeSize * 1.22);
        }

        // Itemized fee breakdown line when Government Fee, Other Charges, Discount, or GST > 0
        if (
          feeSummary.governmentFee > 0 ||
          feeSummary.otherCharges > 0 ||
          feeSummary.discount > 0 ||
          feeSummary.gst > 0 ||
          feeSummary.amountPaid > 0
        ) {
          const parts = [
            `Professional Service Fee: ${formatINR(feeSummary.professionalFee)}`,
            `Government Fee: ${formatINR(feeSummary.governmentFee)}`,
          ];
          if (feeSummary.otherCharges > 0) parts.push(`Other Charges: ${formatINR(feeSummary.otherCharges)}`);
          if (feeSummary.discount > 0) parts.push(`Discount: -${formatINR(feeSummary.discount)}`);
          if (feeSummary.gst > 0) parts.push(`GST/Tax: ${formatINR(feeSummary.gst)}`);
          if (feeSummary.amountPaid > 0) {
            parts.push(`Paid: ${formatINR(feeSummary.amountPaid)}`);
            parts.push(`Balance Due: ${formatINR(feeSummary.balanceDue)}`);
          }
          const breakdownLines = wrapStyledParagraph(parts.join('  |  '), CONTENT_WIDTH, bodySize - 0.3, fonts);
          ensureSpace(breakdownLines.length * lineHeight + 4);
          if (!dryRun) {
            drawWrappedLines(
              page,
              breakdownLines,
              MARGIN_LEFT,
              y - bodySize,
              CONTENT_WIDTH,
              bodySize - 0.3,
              lineHeight,
              fonts,
              darkInk,
              false
            );
          }
          y -= breakdownLines.length * lineHeight + 3;
        }

        // Fillable payment reference & date fields if fillable mode
        if (isFillable && form && !dryRun) {
          ensureSpace(18);
          drawStyledText(page, 'Payment Ref:', MARGIN_LEFT, y - 9, 8.2, fonts, darkInk, true);
          const pr = form.createTextField('payment_reference');
          pr.setText(report.fees.paymentReference || '');
          pr.addToPage(page, {
            x: MARGIN_LEFT + 62,
            y: y - 12,
            width: 155,
            height: 13,
            borderWidth: 0.4,
            borderColor: rgb(0.75, 0.8, 0.86),
            font: fonts.latinRegular,
          });
          pr.setFontSize(8.2);

          drawStyledText(page, 'Payment Date:', MARGIN_LEFT + 230, y - 9, 8.2, fonts, darkInk, true);
          const pd = form.createTextField('payment_date');
          pd.setText(report.fees.paymentDate ? formatDisplayDate(report.fees.paymentDate) : '');
          pd.addToPage(page, {
            x: MARGIN_LEFT + 298,
            y: y - 12,
            width: 110,
            height: 13,
            borderWidth: 0.4,
            borderColor: rgb(0.75, 0.8, 0.86),
            font: fonts.latinRegular,
          });
          pd.setFontSize(8.2);
          y -= 18;
        }
      }

      for (const para of sec.paragraphs) {
        const resolved = replacePlaceholders(para, report);
        if (!resolved.trim()) continue;
        // Handle multi-line lists or bullets inside a paragraph block
        const subLines = resolved.split('\n');
        for (const sub of subLines) {
          const trimmed = sub.trim();
          if (!trimmed) continue;
          const isListItem = /^([•\-*]|\d+\.)\s+/.test(trimmed);
          const indent = isListItem ? 10 : 0;
          const lines = wrapStyledParagraph(trimmed, CONTENT_WIDTH - indent, bodySize, fonts);
          ensureSpace(lines.length * lineHeight + paraGap);
          if (!dryRun) {
            drawWrappedLines(
              page,
              lines,
              MARGIN_LEFT + indent,
              y - bodySize,
              CONTENT_WIDTH - indent,
              bodySize,
              lineHeight,
              fonts,
              darkInk,
              !isListItem
            );
          }
          y -= lines.length * lineHeight + (isListItem ? 2 : paraGap);
        }
      }
      y -= sectionGap - paraGap;
    }

    // 7. DISCLAIMER & FOOTERS ON ALL PAGES
    if (!dryRun) {
      const totalPages = pages.length;
      const disclaimerLines = wrapStyledParagraph(
        orgSettings.disclaimerText,
        CONTENT_WIDTH - 16,
        6.9,
        fonts
      );
      const disclaimerHeight = disclaimerLines.length * 8.6 + 10;
      const lastPage = pages[totalPages - 1];
      const disclaimerY = MARGIN_BOTTOM + 16 + disclaimerHeight;

      lastPage.drawRectangle({
        x: MARGIN_LEFT,
        y: MARGIN_BOTTOM + 16,
        width: CONTENT_WIDTH,
        height: disclaimerHeight,
        color: rgb(0.95, 0.96, 0.97),
      });
      lastPage.drawRectangle({
        x: MARGIN_LEFT,
        y: MARGIN_BOTTOM + 16,
        width: 2.8,
        height: disclaimerHeight,
        color: accentColor,
      });

      drawWrappedLines(
        lastPage,
        disclaimerLines,
        MARGIN_LEFT + 9,
        disclaimerY - 10,
        CONTENT_WIDTH - 16,
        6.9,
        8.6,
        fonts,
        mutedInk,
        false
      );

      for (let i = 0; i < totalPages; i++) {
        const p = pages[i];
        const footerLineY = MARGIN_BOTTOM + 8;
        const footerTextY = MARGIN_BOTTOM - 2;
        p.drawLine({
          start: { x: MARGIN_LEFT, y: footerLineY },
          end: { x: A4_WIDTH - MARGIN_RIGHT, y: footerLineY },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });

        drawStyledText(p, orgSettings.footerLeft, MARGIN_LEFT, footerTextY, 7, fonts, mutedInk, true);

        const centerW = measureStyledText(orgSettings.footerCenter, 7, fonts, false);
        drawStyledText(
          p,
          orgSettings.footerCenter,
          A4_WIDTH / 2 - centerW / 2,
          footerTextY,
          7,
          fonts,
          mutedInk
        );

        const pageText = `Page ${i + 1} of ${totalPages}`;
        const pageW = measureStyledText(pageText, 7, fonts, false);
        drawStyledText(p, pageText, A4_WIDTH - MARGIN_RIGHT - pageW, footerTextY, 7, fonts, mutedInk);
      }

      if (form) {
        form.updateFieldAppearances(fonts.latinRegular);
      }
    }

    return { pageCount: pages.length, pages };
  };

  // Smart page-fit loop: try normal -> compact -> tight to keep single-page layout crisp
  let chosenTier: 'normal' | 'compact' | 'tight' = 'normal';
  const normalCheck = renderWithScale('normal', true);
  if (normalCheck.pageCount > 1) {
    const compactCheck = renderWithScale('compact', true);
    if (compactCheck.pageCount === 1) {
      chosenTier = 'compact';
    } else {
      const tightCheck = renderWithScale('tight', true);
      chosenTier = tightCheck.pageCount === 1 ? 'tight' : 'normal';
    }
  }

  const finalRender = renderWithScale(chosenTier, false);
  const bytes = await pdfDoc.save();

  return {
    bytes,
    pageCount: finalRender.pageCount,
    autoCompressed: chosenTier !== 'normal',
  };
}
