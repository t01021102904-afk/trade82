import { RoleSelection } from "@/components/role-selection";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary, type Locale } from "@/lib/i18n";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

export function RolePageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);

  return (
    <OnboardingPageShell
      backFallbackHref="/"
      label={messages.onboarding.roleLabel}
      title={messages.onboarding.roleTitle}
      description={messages.onboarding.roleDescription}
    >
      <RoleSelection partnerProgramEnabled={isPartnerProgramEnabled()} />
    </OnboardingPageShell>
  );
}
