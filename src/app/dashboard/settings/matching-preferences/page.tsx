import { MatchingPreferencesPage } from "@/components/matching-preferences-page";

export default async function MatchingPreferences() {
  return (
    <MatchingPreferencesPage
      locale="en"
      redirectUrl="/dashboard/settings/matching-preferences"
    />
  );
}
