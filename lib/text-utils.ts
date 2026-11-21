import { ReportPayload } from './types';
import { calculateFees, formatINR, numberToIndianWords } from './fee-calculator';

export function formatDisplayDate(isoOrDate: string): string {
  if (!isoOrDate) return '';
  // If already DD-MM-YYYY, return as-is
  if (/^\d{2}-\d{2}-\d{4}$/.test(isoOrDate)) return isoOrDate;
  const match = isoOrDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function generateDocumentId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LSI-${y}${m}${d}-${rand}`;
}

export function generateReferenceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `TM/ADV/${y}/${rand}`;
}

export function replacePlaceholders(text: string, report: ReportPayload): string {
  const primaryEarlier = report.earlierTrademarks[0];
  const earlierNames = report.earlierTrademarks
    .map((m) => m.markName.trim())
    .filter(Boolean)
    .join(', ');
  const earlierNos = report.earlierTrademarks
    .map((m) => m.applicationNumber.trim())
    .filter(Boolean)
    .join(', ');

  const feeSummary = calculateFees(report.fees);

  const replacements: Record<string, string> = {
    '[BRAND NAME]': report.brandName || 'N/A',
    '[APPLICATION NUMBER]': report.applicationNumber || 'N/A',
    '[TRADEMARK CLASS]': report.trademarkClass || 'N/A',
    '[APPLICANT NAME]': report.applicantName || 'Proprietor',
    '[EARLIER TRADEMARK]': earlierNames || primaryEarlier?.markName || 'N/A',
    '[EARLIER APPLICATION NUMBER]': earlierNos || primaryEarlier?.applicationNumber || 'N/A',
    '[APPLICABLE PROVISION]': report.applicationProvision || 'Section 11',
    '[JURISDICTION]': report.applicableJurisdiction || 'India',
    '[TOTAL CHARGES]': formatINR(feeSummary.totalPayable, true),
    '[TOTAL CHARGES WORDS]': numberToIndianWords(feeSummary.totalPayable),
    '[PROFESSIONAL FEE]': formatINR(feeSummary.professionalFee, true),
    '[GOVERNMENT FEE]': formatINR(feeSummary.governmentFee, true),
    '[DOCUMENT DATE]': formatDisplayDate(report.documentDate),
    '[PREPARED BY]': report.preparedBy || 'Legal Success India',
  };

  let output = text;
  for (const [token, val] of Object.entries(replacements)) {
    output = output.split(token).join(val);
  }
  return output;
}

export function buildPdfFilename(brandName: string, applicationNumber: string, documentId: string): string {
  const safeBrand = (brandName || 'Trademark')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  const safeApp = (applicationNumber || documentId || 'Report')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `${safeBrand}_${safeApp}_Advisory_Report.pdf`;
}

/**
 * Estimates whether the current report content is compact enough for 1 A4 page,
 * tight (requiring slight font/spacing compression), or likely 2+ pages.
 */
export function estimatePageFit(report: ReportPayload): {
  estimatedUnits: number;
  status: 'single-page' | 'tight-fit' | 'multi-page';
  estimatedPages: number;
  message: string;
} {
  let chars = 0;
  for (const p of report.openingParagraphs) {
    chars += replacePlaceholders(p, report).length;
  }
  for (const sec of report.sections) {
    chars += sec.title.length + 40;
    for (const p of sec.paragraphs) {
      chars += replacePlaceholders(p, report).length + 25;
    }
  }
  const extraMarks = Math.max(0, report.earlierTrademarks.length - 1);
  const units = Math.round(chars / 85) + extraMarks * 3 + report.sections.length * 2;

  if (units <= 34) {
    return {
      estimatedUnits: units,
      status: 'single-page',
      estimatedPages: 1,
      message: 'Fits cleanly on 1 A4 Portrait page.',
    };
  }
  if (units <= 42) {
    return {
      estimatedUnits: units,
      status: 'tight-fit',
      estimatedPages: 1,
      message: 'Compact single-page fit: spacing will auto-tighten in PDF export.',
    };
  }
  const pages = Math.max(2, Math.ceil(units / 38));
  return {
    estimatedUnits: units,
    status: 'multi-page',
    estimatedPages: pages,
    message: `Content exceeds 1 A4 page (~${pages} pages). Automatic multi-page flow enabled.`,
  };
}
