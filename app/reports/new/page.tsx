import Link from 'next/link';
import { FolderArchive } from 'lucide-react';
import {
  getOrganizationSettings,
  listFeePresets,
  listLegalClauses,
  listTemplates,
} from '@/lib/db';
import { createDefaultReportPayload } from '@/lib/default-data';
import { generateDocumentId, generateReferenceNumber, todayIsoDate } from '@/lib/text-utils';
import AppShell from '@/components/AppShell';
import ReportWorkspace from '@/components/ReportWorkspace';

export const dynamic = 'force-dynamic';

export default function CreateReportPage() {
  const templates = listTemplates();
  const clauses = listLegalClauses();
  const feePresets = listFeePresets();
  const orgSettings = getOrganizationSettings();
  const defaultReport = createDefaultReportPayload(
    generateDocumentId(),
    generateReferenceNumber(),
    todayIsoDate()
  );

  return (
    <AppShell
      breadcrumb="Create New Report"
      primaryAction={
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <FolderArchive className="h-4 w-4" />
          Saved Reports
        </Link>
      }
    >
      <ReportWorkspace
        defaultReport={defaultReport}
        templates={templates}
        clauses={clauses}
        feePresets={feePresets}
        orgSettings={orgSettings}
      />
    </AppShell>
  );
}
