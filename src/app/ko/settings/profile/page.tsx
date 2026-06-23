import { SettingsPage } from "@/components/settings-page";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoProfileSettingsPage() {
  await requireAppProfile("/ko/settings/profile");
  return <SettingsPage locale="ko" mode="profile" />;
}
