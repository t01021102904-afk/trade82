import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function EnSettingsPage() {
  return (
    <DashboardSettingsPage
      locale="en"
      redirectUrl="/en/dashboard/settings"
    />
  );
}
