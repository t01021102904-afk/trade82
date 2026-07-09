import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function StoreSettingsPage() {
  const { role } = await requireAppProfile("/settings/store");
  return <SettingsPage locale="en" mode="company" role={role} />;
}
