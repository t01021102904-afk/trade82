import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function CompanySettingsPage() {
  const { role } = await requireAppProfile("/settings/company");
  return <SettingsPage locale="en" mode="company" role={role} />;
}
