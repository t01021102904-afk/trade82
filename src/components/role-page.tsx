import { RoleSelection } from "@/components/role-selection";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary, type Locale } from "@/lib/i18n";

export function RolePageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);

  return (
    <OnboardingPageShell
      label={messages.onboarding.roleLabel}
      title={messages.onboarding.roleTitle}
      description={messages.onboarding.roleDescription}
    >
      <RoleSelection />
    </OnboardingPageShell>
  );
}
