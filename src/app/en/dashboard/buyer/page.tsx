import { RoleDashboard } from "@/components/role-dashboard";
import { getDictionary } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function EnBuyerDashboardPage() {
  await requireDashboardRole("/en/dashboard/buyer", "buyer");
  const messages = getDictionary("en");
  return (
    <div className="min-h-screen bg-[#05070a] text-zinc-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            {messages.dashboard.label}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            {messages.settings.buyerDashboard}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {messages.settings.buyerDashboardDescription}
          </p>
        </header>
        <RoleDashboard role="buyer" />
      </div>
    </div>
  );
}
