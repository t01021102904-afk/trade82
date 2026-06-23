import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function EnCompanySettingsPage() {
  await requireAppProfile("/en/settings/company");
  return <SettingsPage locale="en" mode="company" />;
}
