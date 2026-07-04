import { RoleDashboard } from "@/components/role-dashboard";
import { BackButton } from "@/components/back-button";
import { getDictionary } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function BuyerDashboardPage() {
  await requireDashboardRole("/dashboard/buyer", "buyer");
  const messages = getDictionary("en");
  return (
    <div className="min-h-screen theme-bg">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard" />
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            {messages.dashboard.label}
          </p>
          <h1 className="mt-3 text-2xl font-semibold theme-foreground">
            {messages.settings.buyerDashboard}
          </h1>
          <p className="mt-3 text-sm leading-6 theme-muted">
            {messages.settings.buyerDashboardDescription}
          </p>
        </header>
        <RoleDashboard role="buyer" />
      </div>
    </div>
  );
}
