import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { StripeConnectOnboardingPanel } from "@/components/stripe-connect-onboarding-panel";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export default async function StripeConnectSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login?redirect_url=%2Fsettings%2Fstripe-connect");
  const user = await requireAuth();
  const partner = await getDb().partnerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!partner) redirect("/dashboard");
  return <StripeConnectOnboardingPanel ownerType="partner" />;
}
