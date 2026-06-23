import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function EnProfileSettingsPage() {
  await requireAppProfile("/en/settings/profile");
  return <SettingsPage locale="en" mode="profile" />;
}
