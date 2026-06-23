import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function ProfileSettingsPage() {
  await requireAppProfile("/settings/profile");
  return <SettingsPage locale="en" mode="profile" />;
}
