import { DashboardOverview } from "@/components/dashboard-overview";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoDashboardPage() {
  const { role } = await requireAppProfile("/ko/dashboard");
  const messages = getDictionary("ko");
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader label={messages.dashboard.label} title={messages.dashboard.title} description={messages.dashboard.description} />
        <DashboardOverview role={role} />
      </div>
    </div>
  );
}
