import { BackButton } from "@/components/back-button";
import { withLocale, type Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export async function MatchingPreferencesPage({
  locale,
  redirectUrl,
}: {
  locale: Locale;
  redirectUrl: string;
}) {
  await requireDashboardRole(redirectUrl, "seller");

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton
          fallbackHref={withLocale("/dashboard/settings", locale)}
          className="w-fit"
        />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            Settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight theme-foreground">
            Matching Preferences
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
            Control how Trade82 matches your products with buyer RFQs.
          </p>
        </header>

        <section className="rounded-2xl border p-5 theme-surface-elevated">
          <h2 className="text-base font-semibold theme-foreground">
            Coming soon
          </h2>
          <p className="mt-2 text-sm leading-6 theme-muted">
            Matching controls will let sellers tune preferred categories,
            destination markets, MOQ ranges, lead times, and document readiness
            for RFQ matching. For now, Trade82 uses your company profile,
            product listings, and export countries to support matching.
          </p>
        </section>
      </div>
    </div>
  );
}
