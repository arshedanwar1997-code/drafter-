import { listLegalClauses } from '@/lib/db';
import AppShell from '@/components/AppShell';
import LegalContentView from '@/components/LegalContentView';

export const dynamic = 'force-dynamic';

export default function LegalContentPage() {
  const clauses = listLegalClauses();

  return (
    <AppShell breadcrumb="Legal Content Manager">
      <LegalContentView initialClauses={clauses} />
    </AppShell>
  );
}
