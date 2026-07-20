import { RoleSelection } from "@/components/role-selection";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { getDictionary, type Locale } from "@/lib/i18n";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

export function RolePageContent({
  locale,
  deletionPending = false,
}: {
  locale: Locale;
  deletionPending?: boolean;
}) {
  const messages = getDictionary(locale);

  return (
    <OnboardingPageShell
      backFallbackHref="/"
      label={messages.onboarding.roleLabel}
      title={messages.onboarding.roleTitle}
      description={messages.onboarding.roleDescription}
    >
      {deletionPending ? (
        <section className="rounded-2xl border p-6 theme-surface-elevated" role="alert">
          <h2 className="text-lg font-semibold theme-foreground">
            {messages.onboarding.deletionPendingTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 theme-muted">
            {messages.onboarding.deletionPendingText}
          </p>
        </section>
      ) : (
        <RoleSelection partnerProgramEnabled={isPartnerProgramEnabled()} />
      )}
    </OnboardingPageShell>
  );
}
