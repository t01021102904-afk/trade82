import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
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

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "stripe-direct-charge-merchant-start",
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
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return merchantError(error);
  }
}
