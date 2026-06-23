import { RoleDashboard } from "@/components/role-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export default async function KoSellerDashboardPage() {
  await requireDashboardRole("/ko/dashboard/seller", "seller");
  const messages = getDictionary("ko");
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader label={messages.dashboard.label} title={messages.settings.sellerDashboard} description={messages.settings.sellerDashboardDescription} />
        <RoleDashboard role="seller" />
      </div>
    </div>
  );
}
