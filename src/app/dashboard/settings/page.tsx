import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return (
    <DashboardSettingsPage
      locale="en"
      redirectUrl="/dashboard/settings"
      searchParams={searchParams}
    />
  );
}
