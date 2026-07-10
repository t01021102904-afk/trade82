import { MatchingPreferencesPage } from "@/components/matching-preferences-page";

export default async function KoMatchingPreferences() {
  return (
    <MatchingPreferencesPage
      locale="ko"
      redirectUrl="/ko/dashboard/settings/matching-preferences"
    />
  );
}
