import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import {
  isStripeConnectOwnerType,
  startStripeConnectOnboarding,
  StripeConnectOnboardingError,
} from "@/lib/stripe-connect-onboarding";

function onboardingError(error: unknown) {
  if (error instanceof StripeConnectOnboardingError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ownerType: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const ownerType = (await params).ownerType;
    if (!isStripeConnectOwnerType(ownerType)) {
      throw new StripeConnectOnboardingError("Not found.", 404);
    }
    if (ownerType === "partner") {
      throw new StripeConnectOnboardingError("Partner Stripe onboarding has been replaced by manual Korean payout review.", 410);
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: `stripe-connect-onboarding-start:${ownerType}`,
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
      message: "Too many verification requests. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;

    const result = await startStripeConnectOnboarding({ userId: user.id, ownerType });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return onboardingError(error);
  }
}
