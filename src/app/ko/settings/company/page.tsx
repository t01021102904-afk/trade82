import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoCompanySettingsPage() {
  const { role } = await requireAppProfile("/ko/settings/company");
  return <SettingsPage locale="ko" mode="company" role={role} />;
}
