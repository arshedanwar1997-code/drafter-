import { getOrganizationSettings } from '@/lib/db';
import AppShell from '@/components/AppShell';
import SettingsView from '@/components/SettingsView';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const settings = getOrganizationSettings();

  return (
    <AppShell breadcrumb="Settings">
      <SettingsView initialSettings={settings} />
    </AppShell>
  );
}
