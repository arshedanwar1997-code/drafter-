import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { listReports } from '@/lib/db';
import AppShell from '@/components/AppShell';
import SavedReportsView from '@/components/SavedReportsView';

export const dynamic = 'force-dynamic';

export default function SavedReportsPage() {
  const reports = listReports();

  return (
    <AppShell
      breadcrumb="Saved Reports"
      primaryAction={
        <Link
          href="/reports/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="h-4 w-4" />
          Create New Report
        </Link>
      }
    >
      <SavedReportsView initialReports={reports} />
    </AppShell>
  );
}
