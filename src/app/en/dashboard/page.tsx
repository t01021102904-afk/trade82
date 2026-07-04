import { DashboardOverview } from "@/components/dashboard-overview";
import { BackButton } from "@/components/back-button";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";
import { requireAppProfile } from "@/lib/require-auth";
import { redirect } from "next/navigation";

export default async function EnDashboardPage() {
  const { role } = await requireAppProfile("/en/dashboard");
  if (role === "buyer") redirect("/en/dashboard/buyer");
  if (role === "seller" || role === "both") redirect("/en/dashboard/seller");
  if (role === "admin") redirect("/en/admin");

  const messages = getDictionary("en");

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/" />
        <SectionHeader
          label={messages.dashboard.label}
          title={messages.dashboard.title}
          description={messages.dashboard.description}
        />
        <DashboardOverview role={role} />
      </div>
    </div>
  );
}
