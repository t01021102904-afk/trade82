import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function SettingsPage() {
  return (
    <DashboardSettingsPage
      locale="en"
      redirectUrl="/dashboard/settings"
    />
  );
}
