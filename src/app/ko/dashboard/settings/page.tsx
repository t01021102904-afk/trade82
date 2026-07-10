import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function KoSettingsPage() {
  return (
    <DashboardSettingsPage
      locale="ko"
      redirectUrl="/ko/dashboard/settings"
    />
  );
}
