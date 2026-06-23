import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoCompanySettingsPage() {
  await requireAppProfile("/ko/settings/company");
  return <SettingsPage locale="ko" mode="company" />;
}
