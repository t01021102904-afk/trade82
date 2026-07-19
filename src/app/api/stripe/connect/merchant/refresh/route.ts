import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import {
  startSellerStripeMerchantOnboarding,
  StripeDirectChargeMerchantError,
} from "@/lib/stripe-direct-charge-merchant";

function merchantError(error: unknown) {
  if (error instanceof StripeDirectChargeMerchantError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "stripe-connect-merchant-refresh",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
      message: "Too many onboarding requests. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;

    const locale = new URL(request.url).searchParams.get("locale") === "ko" ? "ko" : "en";
    const result = await startSellerStripeMerchantOnboarding({
      userId: user.id,
      locale,
    });
    return Response.redirect(result.url, 303);
  } catch (error) {
    return merchantError(error);
  }
}

export { POST } from "@/app/api/stripe/connect/merchant/start/route";
