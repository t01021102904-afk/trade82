import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PartnerDashboardView } from "@/components/partner-dashboard-view";
import { PartnerProgramLanding } from "@/components/partner-program-landing";
import { PartnerProfileStatus } from "@/generated/prisma/client";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getPartnerDashboardData } from "@/lib/partner-dashboard";
import { getAppUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function toPage(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function KoPartnerDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId } = await auth();
  if (!userId) redirect("/ko/login?redirect_url=%2Fko%2Fpartner%2Fdashboard");
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/ko/partner");
  const partner = await getDb().partnerProfile.findUnique({ where: { userId: profile.id }, select: { id: true, status: true, referralCode: true } });
  if (!partner) redirect("/ko/partner");
  if (partner.status !== PartnerProfileStatus.ACTIVE) return <PartnerProgramLanding state="suspended" />;
  const params = await searchParams;
  const data = await getPartnerDashboardData({ partnerProfileId: partner.id, commissionPage: toPage(params.commissionPage), memberPage: toPage(params.memberPage) });
  return <PartnerDashboardView locale="ko" data={data} referralUrl={`${getAppUrl().replace(/\/$/, "")}/r/${partner.referralCode}`} />;
}
