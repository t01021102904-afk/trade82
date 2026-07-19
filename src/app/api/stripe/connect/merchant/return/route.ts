import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/authz";
import { returnFromSellerStripeMerchantOnboarding } from "@/lib/stripe-direct-charge-merchant";

export async function GET(request: Request) {
  const user = await requireAuth();
  const locale = new URL(request.url).searchParams.get("locale") === "ko" ? "ko" : "en";
  try {
    await returnFromSellerStripeMerchantOnboarding({ userId: user.id });
  } catch {
    // The settings page is the safe recovery surface. It reloads the
    // persisted, sanitized state without exposing Stripe response details.
  }
  redirect(locale === "ko" ? "/ko/settings/stripe-merchant" : "/settings/stripe-merchant");
}
