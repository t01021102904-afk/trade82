import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export default async function KoStripeConnectSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/ko/login?redirect_url=%2Fko%2Fsettings%2Fstripe-connect");
  const user = await requireAuth();
  const partner = await getDb().partnerProfile.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!partner) redirect("/ko/dashboard");
  redirect("/ko/onboarding/partner?edit=1");
}
