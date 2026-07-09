import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function EnCompanySettingsPage() {
  const { role } = await requireAppProfile("/en/settings/company");
  return <SettingsPage locale="en" mode="company" role={role} />;
}
