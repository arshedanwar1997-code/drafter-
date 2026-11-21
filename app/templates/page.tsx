import { listTemplates } from '@/lib/db';
import AppShell from '@/components/AppShell';
import TemplatesView from '@/components/TemplatesView';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const templates = listTemplates();

  return (
    <AppShell breadcrumb="PDF Templates">
      <TemplatesView initialTemplates={templates} />
    </AppShell>
  );
}
