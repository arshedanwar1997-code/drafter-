import { listFeePresets } from '@/lib/db';
import AppShell from '@/components/AppShell';
import FeesView from '@/components/FeesView';

export const dynamic = 'force-dynamic';

export default function FeesPage() {
  const presets = listFeePresets();

  return (
    <AppShell breadcrumb="Fee Management">
      <FeesView initialPresets={presets} />
    </AppShell>
  );
}
