'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  EarlierTrademark,
  FeePreset,
  LegalClause,
  OrganizationSettings,
  ReportPayload,
  ReportTemplate,
  SavedReport,
} from '@/lib/types';
import { createDefaultReportPayload } from '@/lib/default-data';
import { buildPdfFilename, generateDocumentId, generateReferenceNumber } from '@/lib/text-utils';
import ComboField from './ComboField';
import LegalContentEditor from './LegalContentEditor';
import FeeCalculator from './FeeCalculator';
import PdfPreview from './PdfPreview';
import ConfirmDialog from './ConfirmDialog';

interface ReportWorkspaceProps {
  initialReport?: SavedReport | null;
  defaultReport?: ReportPayload;
  templates: ReportTemplate[];
  clauses: LegalClause[];
  feePresets: FeePreset[];
  orgSettings: OrganizationSettings;
}

const PROVISION_OPTIONS = [
  'Section 9 – Absolute Grounds for Refusal',
  'Section 11 – Relative Grounds for Refusal',
  'Section 12 – Honest Concurrent Use',
  'Section 18 – Application for Registration',
];

const STATUS_OPTIONS = [
  'Application Filed',
  'Formalities Check',
  'Marked for Examination',
  'Under Examination / Examiner Approval',
  'Under Examination',
  'Examination Report Issued',
  'Objection Raised',
  'Advertised in Journal',
  'Opposed',
  'Registered',
];

const SIMILARITY_OPTIONS = [
  'Identical / Visual & Phonetic Similarity',
  'Identical Wordmark',
  'Phonetic Similarity',
  'Visual Similarity',
  'Conceptual Similarity',
  'Device / Logo Similarity',
  'Combination of Similarities',
];

const HEADING_PRESETS = [
  'TRADEMARK EXAMINATION & SECTION 11 ADVISORY NOTICE',
  'TRADEMARK EXAMINATION ADVISORY',
  'SECTION 11 SIMILARITY ADVISORY',
  'TRADEMARK OBJECTION ADVISORY',
  'TRADEMARK EXAMINATION REPORT',
];

export default function ReportWorkspace({
  initialReport,
  defaultReport,
  templates,
  clauses,
  feePresets,
  orgSettings,
}: ReportWorkspaceProps) {
  const router = useRouter();
  const [liveOrgSettings, setLiveOrgSettings] = useState<OrganizationSettings>(orgSettings);
  const [report, setReport] = useState<ReportPayload>(() =>
    initialReport ? { ...initialReport } : defaultReport ? { ...defaultReport } : createDefaultReportPayload()
  );
  const [debouncedReport, setDebouncedReport] = useState<ReportPayload>(report);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tm: true,
    earlier: true,
    heading: false,
    legal: true,
    fees: true,
    styling: false,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'draft' | 'generate' | null>(null);
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(
    initialReport?.id ? `/api/reports/${initialReport.id}/download` : null
  );

  // Debounce live preview updates (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedReport(report);
    }, 150);
    return () => clearTimeout(timer);
  }, [report]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const updateReport = (updater: (prev: ReportPayload) => ReportPayload) => {
    setIsDirty(true);
    setReport(updater);
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    updateReport((prev) => ({
      ...prev,
      applicationProvision: tpl.provision || prev.applicationProvision,
      heading: { ...prev.heading, text: tpl.headingText },
      salutation: tpl.salutation,
      openingParagraphs: [...tpl.openingParagraphs],
      sections: tpl.sections.map((s) => ({ ...s, paragraphs: [...s.paragraphs] })),
      fees: {
        ...prev.fees,
        professionalFee: tpl.defaultProfessionalFee,
        governmentFee: tpl.defaultGovernmentFee,
      },
    }));
    setStatusMessage({ type: 'success', text: `Template "${tpl.name}" applied to report.` });
  };

  const validateRequired = (): string | null => {
    if (!report.brandName.trim()) return 'Brand Name is required.';
    if (!report.applicationNumber.trim()) return 'Trademark Application Number is required.';
    if (!report.heading.text.trim()) return 'Main Document Heading cannot be empty.';
    if (!report.adminVerified) {
      return 'Please check Administrator Legal Verification before generating the final PDF.';
    }
    return null;
  };

  const handleSaveDraft = async (skipFinalizeCheck = false) => {
    if (!report.brandName.trim() || !report.applicationNumber.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Brand Name and Trademark Application Number are required to save.',
      });
      return;
    }

    if (initialReport?.reportStatus === 'Finalized' && !skipFinalizeCheck) {
      setPendingAction('draft');
      setConfirmOverwriteOpen(true);
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const url = report.id ? `/api/reports/${report.id}` : '/api/reports';
      const method = report.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...report,
          reportStatus: report.reportStatus === 'Finalized' ? 'Finalized' : 'Draft',
          confirmFinalizedOverwrite: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save report.');

      setReport(data.report);
      setIsDirty(false);
      setGeneratedDownloadUrl(`/api/reports/${data.report.id}/download`);
      setStatusMessage({ type: 'success', text: `Report saved (${data.report.documentId}).` });
      if (!initialReport) {
        router.replace(`/reports/${data.report.id}`);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save report.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (triggerDownload: boolean, skipFinalizeCheck = false) => {
    const validationErr = validateRequired();
    if (validationErr) {
      setStatusMessage({ type: 'error', text: validationErr });
      return;
    }

    if (initialReport?.reportStatus === 'Finalized' && !skipFinalizeCheck) {
      setPendingAction('generate');
      setConfirmOverwriteOpen(true);
      return;
    }

    setGenerating(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PDF generation failed.');

      setReport(data.report);
      setIsDirty(false);
      setGeneratedDownloadUrl(data.downloadUrl);

      if (triggerDownload && data.pdfBase64) {
        const binary = atob(data.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = data.filename || buildPdfFilename(report.brandName, report.applicationNumber, report.documentId);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }

      setStatusMessage({
        type: 'success',
        text: `Generated ${data.pageCount}-page ${
          report.styling.exportMode === 'fillable' ? 'Fillable AcroForm ' : ''
        }PDF (${data.filename}).`,
      });

      if (!initialReport && data.report?.id) {
        router.replace(`/reports/${data.report.id}`);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'PDF generation failed.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDuplicate = async () => {
    if (!report.id) return;
    const res = await fetch(`/api/reports/${report.id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.report?.id) {
      router.push(`/reports/${data.report.id}`);
    }
  };

  const handleReset = () => {
    const fresh = createDefaultReportPayload();
    fresh.documentId = generateDocumentId();
    fresh.reportReferenceNumber = generateReferenceNumber();
    setReport(fresh);
    setIsDirty(false);
    setConfirmResetOpen(false);
    setStatusMessage({ type: 'success', text: 'Form reset to default Section 11 advisory structure.' });
  };

  const addEarlierTrademark = () => {
    const nextItem: EarlierTrademark = {
      id: `em-${Date.now()}`,
      markName: '',
      applicationNumber: '',
      registrationNumber: '',
      trademarkClass: report.trademarkClass || '',
      proprietorName: '',
      status: 'Registered',
      similarityType: 'Phonetic Similarity',
      similarityDescription: '',
    };
    updateReport((prev) => ({
      ...prev,
      earlierTrademarks: [...prev.earlierTrademarks, nextItem],
    }));
  };

  const sectionHeader = (key: string, title: string, subtitle?: string) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      aria-expanded={openSections[key]}
      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {openSections[key] ? (
        <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="template-picker" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Load Template:
            </label>
            <select
              id="template-picker"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#142F55] focus:outline-none"
            >
              <option value="">Select advisory template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-500 tabular-nums">
            ID: <strong className="text-slate-800">{report.documentId}</strong>
            <span className="mx-1.5 text-slate-300">·</span>
            Status: <strong className="text-slate-800">{report.reportStatus}</strong>
            {isDirty && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="text-amber-700 font-medium">Unsaved changes</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Form
          </button>

          {report.id && (
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveDraft()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            Print PDF
          </button>

          {generatedDownloadUrl && (
            <a
              href={`${generatedDownloadUrl}?mode=${report.styling.exportMode}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#142F55] bg-white px-3 py-1.5 text-xs font-medium text-[#142F55] hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </a>
          )}

          <button
            type="button"
            onClick={() => handleGeneratePdf(true)}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0f2442] disabled:opacity-50 whitespace-nowrap"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCheck2 className="h-3.5 w-3.5" />
            )}
            Generate & Download PDF
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm no-print ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Split Two-Panel Workspace: Form (Left) + Live A4 Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: Dynamic Form */}
        <div className="xl:col-span-6 space-y-3 no-print">
          {/* Section B: Trademark Application Details */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader('tm', 'Section B: Trademark Application Details', 'Brand name, application number, class, provision, and status')}
            {openSections.tm && (
              <div className="border-t border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="header-left-text-field" className="block text-xs font-medium text-slate-700 mb-1">
                    Header Left Text (Top-Left of PDF)
                  </label>
                  <input
                    id="header-left-text-field"
                    type="text"
                    value={report.headerLeftText ?? 'From: Legal Success India'}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, headerLeftText: e.target.value }))
                    }
                    placeholder="e.g. From: Legal Success India"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Brand Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={report.brandName}
                    onChange={(e) => updateReport((p) => ({ ...p, brandName: e.target.value }))}
                    placeholder="e.g. ANZORA"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Trademark Application Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={report.applicationNumber}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, applicationNumber: e.target.value }))
                    }
                    placeholder="e.g. 8127206"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Trademark Class
                  </label>
                  <input
                    type="text"
                    value={report.trademarkClass}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, trademarkClass: e.target.value }))
                    }
                    placeholder="e.g. Class 35"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Application Date
                  </label>
                  <input
                    type="date"
                    value={report.applicationDate}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, applicationDate: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
                  />
                </div>

                <ComboField
                  label="Application Provision"
                  value={report.applicationProvision}
                  options={PROVISION_OPTIONS}
                  onChange={(val) => updateReport((p) => ({ ...p, applicationProvision: val }))}
                />

                <ComboField
                  label="Current Application Status"
                  value={report.currentStatus}
                  options={STATUS_OPTIONS}
                  onChange={(val) => updateReport((p) => ({ ...p, currentStatus: val }))}
                />

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Subject / Examination Concern
                  </label>
                  <input
                    type="text"
                    value={report.subject}
                    onChange={(e) => updateReport((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Examination Process
                  </label>
                  <input
                    type="text"
                    value={report.examinationProcess}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, examinationProcess: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Applicable Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={report.applicableJurisdiction}
                    onChange={(e) =>
                      updateReport((p) => ({ ...p, applicableJurisdiction: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Report Workflow Status
                  </label>
                  <select
                    value={report.reportStatus}
                    onChange={(e) =>
                      updateReport((p) => ({
                        ...p,
                        reportStatus: e.target.value as ReportPayload['reportStatus'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Generated">Generated</option>
                    <option value="Finalized">Finalized</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section C: Earlier Trademark Details */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader(
              'earlier',
              `Section C: Earlier Trademark Details (${report.earlierTrademarks.length})`,
              'Add one or more cited earlier registered or pending trademarks'
            )}
            {openSections.earlier && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                {report.earlierTrademarks.map((em, idx) => (
                  <div
                    key={em.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#142F55]">
                        Cited Earlier Trademark #{idx + 1}
                      </span>
                      {report.earlierTrademarks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateReport((p) => ({
                              ...p,
                              earlierTrademarks: p.earlierTrademarks.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={`Remove earlier trademark ${idx + 1}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Trademark Name
                        </label>
                        <input
                          type="text"
                          value={em.markName}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], markName: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Application Number
                        </label>
                        <input
                          type="text"
                          value={em.applicationNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], applicationNumber: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Registration No.
                        </label>
                        <input
                          type="text"
                          value={em.registrationNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], registrationNumber: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Trademark Class
                        </label>
                        <input
                          type="text"
                          value={em.trademarkClass}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], trademarkClass: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Applicant / Proprietor
                        </label>
                        <input
                          type="text"
                          value={em.proprietorName}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], proprietorName: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Earlier Trademark Status
                        </label>
                        <input
                          type="text"
                          value={em.status}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], status: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <ComboField
                          label="Similarity Type"
                          value={em.similarityType}
                          options={SIMILARITY_OPTIONS}
                          onChange={(val) =>
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], similarityType: val };
                              return { ...p, earlierTrademarks: copy };
                            })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Similarity Description
                        </label>
                        <textarea
                          rows={2}
                          value={em.similarityDescription}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateReport((p) => {
                              const copy = [...p.earlierTrademarks];
                              copy[idx] = { ...copy[idx], similarityDescription: val };
                              return { ...p, earlierTrademarks: copy };
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addEarlierTrademark}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142F55] hover:bg-slate-50 w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  ADD EARLIER TRADEMARK
                </button>
              </div>
            )}
          </div>

          {/* Section D: Main Document Heading */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader('heading', 'Section D: Main Document Heading', 'Heading text, size, double-line divider, and alignment')}
            {openSections.heading && (
              <div className="border-t border-slate-200 p-4 space-y-3">
                <ComboField
                  label="Document Heading Text"
                  value={report.heading.text}
                  options={HEADING_PRESETS}
                  onChange={(val) =>
                    updateReport((p) => ({ ...p, heading: { ...p.heading, text: val } }))
                  }
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Font Size (pt)
                    </label>
                    <input
                      type="number"
                      min={13}
                      max={22}
                      value={report.heading.fontSize}
                      onChange={(e) =>
                        updateReport((p) => ({
                          ...p,
                          heading: { ...p.heading, fontSize: Number(e.target.value) || 18 },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Alignment</label>
                    <select
                      value={report.heading.alignment}
                      onChange={(e) =>
                        updateReport((p) => ({
                          ...p,
                          heading: {
                            ...p.heading,
                            alignment: e.target.value as 'left' | 'center',
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Centered</option>
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={report.heading.bold}
                      onChange={(e) =>
                        updateReport((p) => ({
                          ...p,
                          heading: { ...p.heading, bold: e.target.checked },
                        }))
                      }
                    />
                    Bold Heading
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={report.heading.underline}
                      onChange={(e) =>
                        updateReport((p) => ({
                          ...p,
                          heading: { ...p.heading, underline: e.target.checked },
                        }))
                      }
                    />
                    Double Line Divider
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section E: Legal Content Editor */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader('legal', 'Section E: Legal Content Editor', 'Editable opening remarks, numbered statutory sections, and placeholders')}
            {openSections.legal && (
              <div className="border-t border-slate-200 p-4">
                <LegalContentEditor
                  salutation={report.salutation}
                  openingParagraphs={report.openingParagraphs}
                  sections={report.sections}
                  adminVerified={report.adminVerified}
                  clauses={clauses}
                  onChangeSalutation={(val) => updateReport((p) => ({ ...p, salutation: val }))}
                  onChangeOpeningParagraphs={(paras) =>
                    updateReport((p) => ({ ...p, openingParagraphs: paras }))
                  }
                  onChangeSections={(sections) => updateReport((p) => ({ ...p, sections }))}
                  onChangeAdminVerified={(val) =>
                    updateReport((p) => ({ ...p, adminVerified: val }))
                  }
                  onRestoreDefault={() => {
                    const d = createDefaultReportPayload();
                    updateReport((p) => ({
                      ...p,
                      salutation: d.salutation,
                      openingParagraphs: d.openingParagraphs,
                      sections: d.sections,
                    }));
                  }}
                />
              </div>
            )}
          </div>

          {/* Section F: Fee Calculator */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader('fees', 'Section F: Fee Calculator & Payment Information', 'Professional service fee, separate statutory fee, and INR totals')}
            {openSections.fees && (
              <div className="border-t border-slate-200 p-4">
                <FeeCalculator
                  fees={report.fees}
                  presets={feePresets}
                  onChange={(fees) => updateReport((p) => ({ ...p, fees }))}
                />
              </div>
            )}
          </div>

          {/* Section G: Document Styling & Export Mode */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {sectionHeader('styling', 'Section G: PDF Styling & Export Mode', 'Standard searchable PDF vs Fillable AcroForm PDF & Hindi labels')}
            {openSections.styling && (
              <div className="border-t border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PDF Export Mode
                  </label>
                  <select
                    value={report.styling.exportMode}
                    onChange={(e) =>
                      updateReport((p) => ({
                        ...p,
                        styling: {
                          ...p.styling,
                          exportMode: e.target.value as 'standard' | 'fillable',
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="standard">Mode 1: Standard Searchable Print PDF</option>
                    <option value="fillable">Mode 2: Editable Fillable AcroForm PDF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Body Font Size (pt)
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={10.5}
                    step={0.5}
                    value={report.styling.bodyFontSize}
                    onChange={(e) =>
                      updateReport((p) => ({
                        ...p,
                        styling: { ...p.styling, bodyFontSize: Number(e.target.value) || 9 },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 sm:col-span-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={report.styling.includeHindiLabels}
                    onChange={(e) =>
                      updateReport((p) => ({
                        ...p,
                        styling: { ...p.styling, includeHindiLabels: e.target.checked },
                      }))
                    }
                  />
                  Include Bilingual Hindi + English Metadata Labels (ब्रांड नाम / Brand Name)
                </label>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Sticky Live A4 Portrait Preview */}
        <div className="xl:col-span-6 xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)] flex flex-col">
          <PdfPreview
            report={debouncedReport}
            orgSettings={liveOrgSettings}
            headerLeftText={report.headerLeftText}
            onHeaderImageChange={(url) =>
              setLiveOrgSettings((prev) => ({ ...prev, headerBannerImage: url }))
            }
            onHeaderLeftTextChange={(value) =>
              updateReport((prev) => ({ ...prev, headerLeftText: value }))
            }
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset Report Form?"
        description="This will replace all current unsaved entries with the default Section 11 advisory structure."
        confirmLabel="Reset Form"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmResetOpen(false)}
      />

      <ConfirmDialog
        open={confirmOverwriteOpen}
        title="Overwrite Finalized Report?"
        description="This report is currently marked as Finalized. Saving or regenerating will update the stored finalized document."
        confirmLabel="Confirm Overwrite"
        onConfirm={() => {
          setConfirmOverwriteOpen(false);
          if (pendingAction === 'draft') handleSaveDraft(true);
          if (pendingAction === 'generate') handleGeneratePdf(true, true);
          setPendingAction(null);
        }}
        onCancel={() => {
          setConfirmOverwriteOpen(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
}
