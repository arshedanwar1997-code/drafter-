'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { OrganizationSettings, ReportPayload } from '@/lib/types';
import { calculateFees, formatINR, numberToIndianWords } from '@/lib/fee-calculator';
import { estimatePageFit, formatDisplayDate, replacePlaceholders } from '@/lib/text-utils';
import { DEFAULT_ORGANIZATION_SETTINGS } from '@/lib/default-data';

interface PdfPreviewProps {
  report: ReportPayload;
  orgSettings?: OrganizationSettings;
  headerLeftText?: string;
  onHeaderImageChange?: (dataUrl: string) => void;
  onHeaderLeftTextChange?: (value: string) => void;
}

function renderInlineFormatted(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return (
        <span key={idx} className="underline">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function PdfPreview({
  report,
  orgSettings = DEFAULT_ORGANIZATION_SETTINGS,
  headerLeftText,
  onHeaderImageChange,
  onHeaderLeftTextChange,
}: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftInputRef = useRef<HTMLInputElement | null>(null);
  const [fitZoom, setFitZoom] = useState<number>(0.65);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [overrideHeaderImg, setOverrideHeaderImg] = useState<string | undefined>(undefined);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const zoom = manualZoom ?? fitZoom;
  const headerImage =
    overrideHeaderImg !== undefined ? overrideHeaderImg : orgSettings.headerBannerImage || '';

  const persistHeaderImage = async (dataUrl: string) => {
    setOverrideHeaderImg(dataUrl);
    onHeaderImageChange?.(dataUrl);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headerBannerImage: dataUrl }),
      });
    } catch {
      // keep preview state even if offline
    }
  };

  const handleHeaderPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingHeader(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.onload = () => {
          const img = new window.Image();
          img.onerror = () => reject(new Error('Invalid image'));
          img.onload = () => {
            const maxW = 900;
            const maxH = 260;
            const ratio = Math.min(1, maxW / img.width, maxH / img.height);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * ratio));
            canvas.height = Math.max(1, Math.round(img.height * ratio));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas unavailable'));
              return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      });
      await persistHeaderImage(dataUrl);
    } finally {
      setUploadingHeader(false);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateFit = () => {
      const avail = el.clientWidth - 40;
      if (avail > 100) {
        // 210mm at 96dpi is ~794px
        const next = Math.min(0.9, Math.max(0.42, Number((avail / 794).toFixed(2))));
        setFitZoom(next);
      }
    };
    updateFit();
    const obs = new ResizeObserver(updateFit);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const feeSummary = useMemo(() => calculateFees(report.fees), [report.fees]);
  const pageFit = useMemo(() => estimatePageFit(report), [report]);
  const includeHindi = report.styling?.includeHindiLabels !== false;
  const primaryColor = report.styling?.primaryColor || orgSettings.primaryColor || '#142F55';
  const accentColor = report.styling?.accentColor || orgSettings.accentColor || '#B8A16A';

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

  const recipientDisplay =
    [report.applicantName, report.organizationName].filter((s) => s && s.trim()).join(' — ') ||
    'Dear Proprietor';

  const l = (hi: string, en: string) => (includeHindi ? `${hi}/${en}:` : `${en}:`);

  const chargesDisplay =
    feeSummary.governmentFee > 0
      ? `${formatINR(feeSummary.totalPayable)} (Prof. ${formatINR(feeSummary.professionalFee, false)} + Govt. ${formatINR(feeSummary.governmentFee, false)})`
      : `${formatINR(feeSummary.totalPayable)} (${numberToIndianWords(feeSummary.totalPayable)})`;

  const metaRows = [
    { label: 'From:', value: report.preparedBy || 'Legal Success India', bold: true },
    { label: includeHindi ? 'सेवा में / To:' : 'To / Applicant:', value: recipientDisplay },
    { label: l('ब्रांड नाम', 'Brand Name'), value: report.brandName || '—', bold: true, large: true },
    {
      label: l('ट्रेडमार्क आवेदन संख्या', 'Trademark Application No.'),
      value: report.applicationNumber || '—',
      bold: true,
    },
    ...(report.trademarkClass
      ? [{ label: l('ट्रेडमार्क वर्ग', 'Trademark Class'), value: report.trademarkClass }]
      : []),
    { label: l('लागू प्रावधान', 'Applicable Provision'), value: report.applicationProvision, bold: true },
    { label: l('वर्तमान स्थिति', 'Current Status'), value: report.currentStatus },
    { label: l('विषय', 'Subject'), value: report.subject },
    { label: l('प्रक्रिया', 'Process'), value: report.examinationProcess },
    { label: l('लागू क्षेत्राधिकार', 'Applicable Jurisdiction'), value: report.applicableJurisdiction },
    { label: l('पूर्व पंजीकृत ट्रेडमार्क', 'Earlier Registered Trademark'), value: earlierNames, bold: true },
    { label: l('पूर्व आवेदन संख्या', 'Earlier Application No.'), value: earlierNos, bold: true },
    { label: l('सेवा शुल्क', 'Applicable Charges'), value: chargesDisplay, bold: true },
    {
      label: l('भुगतान मोड', 'Payment Mode'),
      value: report.fees.paymentMode || orgSettings.defaultPaymentMode,
    },
  ];

  const a4Sheet = (
    <div
      data-testid="a4-preview-sheet"
      className="doc-preview-font print-only-sheet bg-white text-[#111111] shadow-md border border-slate-200 mx-auto relative flex flex-col justify-between"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '11.5mm 16mm 12mm 16mm',
        fontSize: `${report.styling?.bodyFontSize || 9}pt`,
        lineHeight: report.styling?.lineSpacing || 1.2,
      }}
    >
      <div>
        {/* 1. Three-Column Private Advisory Header */}
        <div
          className="flex items-start justify-between pb-2 mb-2.5"
          style={{ borderBottom: `1.5px solid ${primaryColor}` }}
        >
          <div className="w-[34%] self-end leading-tight -mb-1 pr-2">
            {(() => {
              const leftVal = headerLeftText ?? report.headerLeftText ?? 'From: Legal Success India';
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 no-print">
                    <button
                      type="button"
                      onClick={() => {
                        leftInputRef.current?.focus();
                        leftInputRef.current?.select();
                      }}
                      aria-label="Edit header left text"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      Edit
                    </button>
                    {leftVal.trim() && onHeaderLeftTextChange && (
                      <button
                        type="button"
                        onClick={() => onHeaderLeftTextChange('')}
                        aria-label="Clear header left text"
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    ref={leftInputRef}
                    type="text"
                    value={leftVal}
                    onChange={(e) => onHeaderLeftTextChange?.(e.target.value)}
                    readOnly={!onHeaderLeftTextChange}
                    aria-label="Header left text"
                    placeholder="Enter left header text..."
                    className={`w-full bg-transparent text-[8.5pt] font-bold text-[#111111] placeholder:font-normal placeholder:text-slate-400 rounded px-1 py-0.5 border border-dashed border-slate-300/80 hover:border-[#142F55] focus:border-[#142F55] focus:bg-slate-50/70 focus:outline-none print:border-0 print:px-0 print:py-0 ${
                      !leftVal.trim() ? 'print:hidden' : ''
                    }`}
                  />
                </div>
              );
            })()}
          </div>

          <div className="w-[41%] flex flex-col items-center justify-center min-h-[48px] px-2">
            {headerImage ? (
              <div className="flex flex-col items-center gap-1">
                <Image
                  src={headerImage}
                  alt="Uploaded Header Photo"
                  width={260}
                  height={56}
                  referrerPolicy="no-referrer"
                  className="max-h-14 w-auto max-w-full object-contain"
                />
                <div className="flex items-center gap-2 no-print">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100">
                    <Upload className="h-2.5 w-2.5" />
                    Change
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeaderPhotoUpload}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => persistHeaderImage('')}
                    aria-label="Remove header photo"
                    className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="no-print flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-2 text-[11px] font-semibold text-[#142F55] hover:border-[#142F55] hover:bg-slate-100 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingHeader ? 'Uploading...' : 'Upload Header Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeaderPhotoUpload}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          <div className="w-[25%] text-right self-end leading-tight -mb-1">
            <div className="text-[9.5pt] font-bold text-[#111111] tabular-nums leading-tight">
              DATE : {formatDisplayDate(report.documentDate)}
            </div>
            <div className="text-[7.5pt] text-[#555555] mt-0.5 tabular-nums leading-tight">
              Ref: {report.reportReferenceNumber}
            </div>
          </div>
        </div>

        {/* 2. Compact Two-Column Application Information Block */}
        <div
          className="rounded-sm px-2.5 py-2 mb-3"
          style={{ backgroundColor: '#FFFFFF', border: '0.6px solid #D6DCE5' }}
        >
          <div className="space-y-0.5">
            {metaRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[195px_1fr] items-baseline gap-2 leading-snug">
                <div className="text-[8.2pt] font-bold text-[#171717]">{row.label}</div>
                <div
                  className={`${row.large ? 'text-[11.5pt]' : 'text-[8.3pt]'} ${
                    row.bold ? 'font-bold' : 'font-normal'
                  } tabular-nums`}
                  style={{ color: row.large ? '#000000' : '#111111' }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Main Heading + Double Horizontal Line */}
        <div className="mb-3">
          <h1
            className="leading-tight"
            style={{
              fontSize: `${report.heading.fontSize}pt`,
              fontWeight: report.heading.bold ? 800 : 600,
              textAlign: report.heading.alignment,
              textTransform: report.heading.uppercase ? 'uppercase' : 'none',
              color: '#111111',
            }}
          >
            {report.heading.text}
          </h1>
          {report.heading.underline && (
            <div className="mt-1.5 space-y-[2.5px]">
              <div style={{ height: '1.6px', backgroundColor: primaryColor }} />
              <div style={{ height: '0.8px', backgroundColor: primaryColor }} />
            </div>
          )}
        </div>

        {/* 4. Opening Salutation & Paragraphs */}
        <div className="mb-2.5">
          {report.salutation && (
            <div className="font-bold text-[#111111] mb-1">{report.salutation}</div>
          )}
          <div className="space-y-1.5 text-justify text-[#171717]">
            {report.openingParagraphs.map((p, idx) => (
              <p key={idx}>{renderInlineFormatted(replacePlaceholders(p, report))}</p>
            ))}
          </div>
        </div>

        {/* 5. Application & Earlier Mark Summary */}
        <div className="mb-3 space-y-0.5">
          <div className="grid grid-cols-[175px_1fr] gap-2">
            <span className="font-bold">Applied Trademark:</span>
            <span className="font-bold">{report.brandName}</span>
          </div>
          <div className="grid grid-cols-[175px_1fr] gap-2">
            <span className="font-bold">Trademark Application No.:</span>
            <span className="font-bold tabular-nums">{report.applicationNumber}</span>
          </div>
          {report.earlierTrademarks.map((em, idx) => {
            const suffix = report.earlierTrademarks.length > 1 ? ` (${idx + 1})` : '';
            return (
              <React.Fragment key={em.id}>
                <div className="grid grid-cols-[175px_1fr] gap-2">
                  <span className="font-bold">Earlier Registered Trademark{suffix}:</span>
                  <span className="font-bold">{em.markName || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[175px_1fr] gap-2">
                  <span className="font-bold">Earlier Application No.{suffix}:</span>
                  <span className="font-bold tabular-nums">
                    {em.applicationNumber || 'N/A'}
                    {em.status ? ` (${em.status})` : ''}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* 6. Numbered Legal Sections */}
        <div className="space-y-2.5">
          {report.sections.map((sec) => (
            <section key={sec.id}>
              <h2
                className={`text-[10.5pt] font-bold text-[#111111] mb-1 ${
                  sec.underlineHeading ? 'underline underline-offset-2' : ''
                }`}
              >
                {sec.number}. {replacePlaceholders(sec.title, report)}
              </h2>

              {sec.isFeeSection && (
                <div className="mb-1.5">
                  <div
                    className="text-[12pt] font-extrabold tabular-nums"
                    style={{ color: primaryColor }}
                  >
                    Applicable Service Charges: {formatINR(feeSummary.totalPayable)} (
                    {numberToIndianWords(feeSummary.totalPayable)})
                  </div>
                  {(feeSummary.governmentFee > 0 ||
                    feeSummary.otherCharges > 0 ||
                    feeSummary.discount > 0 ||
                    feeSummary.gst > 0 ||
                    feeSummary.amountPaid > 0) && (
                    <div className="text-[8.2pt] text-slate-700 mt-0.5 tabular-nums">
                      Professional Service Fee: {formatINR(feeSummary.professionalFee)} | Government
                      Fee: {formatINR(feeSummary.governmentFee)}
                      {feeSummary.otherCharges > 0 &&
                        ` | Other Charges: ${formatINR(feeSummary.otherCharges)}`}
                      {feeSummary.discount > 0 && ` | Discount: -${formatINR(feeSummary.discount)}`}
                      {feeSummary.gst > 0 && ` | GST/Tax: ${formatINR(feeSummary.gst)}`}
                      {feeSummary.amountPaid > 0 &&
                        ` | Paid: ${formatINR(feeSummary.amountPaid)} | Balance Due: ${formatINR(
                          feeSummary.balanceDue
                        )}`}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1 text-justify text-[#171717]">
                {sec.paragraphs.map((p, pIdx) => (
                  <div key={pIdx} className="whitespace-pre-line">
                    {renderInlineFormatted(replacePlaceholders(p, report))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* 7. Private Advisory Disclaimer + Footer */}
      <div className="mt-4 pt-2">
        <div
          className="px-2.5 py-2 text-[7pt] text-[#555555] leading-snug mb-2"
          style={{
            backgroundColor: '#F2F4F7',
            borderLeft: `3px solid ${accentColor}`,
          }}
        >
          {orgSettings.disclaimerText}
        </div>
        <div className="flex items-center justify-between border-t border-[#CCCCCC] pt-1.5 text-[7pt] text-[#777777]">
          <span className="font-semibold">{orgSettings.footerLeft}</span>
          <span>{orgSettings.footerCenter}</span>
          <span className="tabular-nums">Page 1 of {pageFit.estimatedPages}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border border-slate-200 bg-white px-4 py-2.5 no-print">
        <div className="flex items-center gap-2 text-xs">
          {pageFit.status === 'single-page' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {pageFit.message}
            </span>
          )}
          {pageFit.status !== 'single-page' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {pageFit.message}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setManualZoom(Math.max(0.4, Number((zoom - 0.08).toFixed(2))))}
            aria-label="Zoom out preview"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center text-xs font-medium text-slate-700 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setManualZoom(Math.min(1.25, Number((zoom + 0.08).toFixed(2))))}
            aria-label="Zoom in preview"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setManualZoom(null)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="Full screen preview"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable A4 Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto rounded-b-xl border-x border-b border-slate-200 bg-slate-100 p-4"
      >
        <div
          className="mx-auto"
          style={{
            width: `calc(210mm * ${zoom})`,
            height: `calc(297mm * ${zoom})`,
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: '210mm',
            }}
          >
            {a4Sheet}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 no-print">
          <div className="flex items-center justify-between bg-white px-6 py-3 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-900">
              Full-Screen A4 Preview · {report.brandName} ({report.applicationNumber})
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Exit Full Screen
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">{a4Sheet}</div>
        </div>
      )}
    </div>
  );
}
