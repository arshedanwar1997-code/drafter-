import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  getOrganizationSettings,
  getReportById,
  listFeePresets,
  listLegalClauses,
  listTemplates,
} from '@/lib/db';
import AppShell from '@/components/AppShell';
import ReportWorkspace from '@/components/ReportWorkspace';

export const dynamic = 'force-dynamic';

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = getReportById(id);
  if (!report) notFound();

  const templates = listTemplates();
  const clauses = listLegalClauses();
  const feePresets = listFeePresets();
  const orgSettings = getOrganizationSettings();

  return (
    <AppShell
      breadcrumb={`Edit Report · ${report.brandName}`}
      primaryAction={
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Saved Reports
        </Link>
      }
    >
      <ReportWorkspace
        initialReport={report}
        templates={templates}
        clauses={clauses}
        feePresets={feePresets}
        orgSettings={orgSettings}
      />
    </AppShell>
  );
}
