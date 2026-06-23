import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoStoreSettingsPage() {
  await requireAppProfile("/ko/settings/store");
  return <SettingsPage locale="ko" mode="company" />;
}
