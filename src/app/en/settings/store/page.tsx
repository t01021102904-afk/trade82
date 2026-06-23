import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function EnStoreSettingsPage() {
  await requireAppProfile("/en/settings/store");
  return <SettingsPage locale="en" mode="company" />;
}
