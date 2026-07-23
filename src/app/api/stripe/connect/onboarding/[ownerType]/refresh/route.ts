import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import {
  isStripeConnectOwnerType,
  refreshStripeConnectOnboarding,
  StripeConnectOnboardingError,
} from "@/lib/stripe-connect-onboarding";

function onboardingError(error: unknown) {
  if (error instanceof StripeConnectOnboardingError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

async function refresh(request: Request, ownerTypeValue: string, requireSameOrigin: boolean) {
  if (requireSameOrigin) assertSameOrigin(request);
  const user = await requireAuth();
  if (!isStripeConnectOwnerType(ownerTypeValue)) {
    throw new StripeConnectOnboardingError("Not found.", 404);
  }
  if (ownerTypeValue === "partner") {
    throw new StripeConnectOnboardingError("Partner Stripe onboarding has been replaced by manual Korean payout review.", 410);
  }
  const rateLimited = rateLimitOrResponse({
    request,
    scope: `stripe-connect-onboarding-refresh:${ownerTypeValue}`,
    userId: user.id,
    limit: 20,
    windowMs: 60 * 60_000,
    message: "Too many verification requests. Please wait before trying again.",
  });
  if (rateLimited) return { rateLimited };
  return { result: await refreshStripeConnectOnboarding({ userId: user.id, ownerType: ownerTypeValue }) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ownerType: string }> },
) {
  try {
    const outcome = await refresh(request, (await params).ownerType, false);
    if (outcome.rateLimited) return outcome.rateLimited;
    return Response.redirect(outcome.result.url, 303);
  } catch (error) {
    return onboardingError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ownerType: string }> },
) {
  try {
    const outcome = await refresh(request, (await params).ownerType, true);
    if (outcome.rateLimited) return outcome.rateLimited;
    return Response.json(outcome.result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return onboardingError(error);
  }
}
