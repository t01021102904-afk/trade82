import { DashboardSettingsPage } from "@/components/dashboard-settings-page";

export default async function EnSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return (
    <DashboardSettingsPage
      locale="en"
      redirectUrl="/en/dashboard/settings"
      searchParams={searchParams}
    />
  );
}
