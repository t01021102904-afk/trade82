import { MatchingPreferencesPage } from "@/components/matching-preferences-page";

export default async function EnMatchingPreferences() {
  return (
    <MatchingPreferencesPage
      locale="en"
      redirectUrl="/en/dashboard/settings/matching-preferences"
    />
  );
}
