import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function StoreSettingsPage() {
  await requireAppProfile("/settings/store");
  return <SettingsPage locale="en" mode="company" />;
}
