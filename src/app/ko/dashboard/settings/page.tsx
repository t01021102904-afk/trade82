import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function KoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return (
    <DashboardSettingsPage
      locale="ko"
      redirectUrl="/ko/dashboard/settings"
      searchParams={searchParams}
    />
  );
}
