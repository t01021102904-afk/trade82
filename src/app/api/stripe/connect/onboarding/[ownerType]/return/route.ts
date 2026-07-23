import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import {
  isStripeConnectOwnerType,
  returnFromStripeConnectOnboarding,
  StripeConnectOnboardingError,
} from "@/lib/stripe-connect-onboarding";

function onboardingError(error: unknown) {
  if (error instanceof StripeConnectOnboardingError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ownerType: string }> },
) {
  try {
    const user = await requireAuth();
    const ownerType = (await params).ownerType;
    if (!isStripeConnectOwnerType(ownerType)) {
      throw new StripeConnectOnboardingError("Not found.", 404);
    }
    if (ownerType === "partner") {
      return Response.redirect(new URL("/onboarding/partner?edit=1", request.url), 303);
    }
    await returnFromStripeConnectOnboarding({ userId: user.id, ownerType });
    const destination = ownerType === "seller"
      ? "/settings/payout-information?stripe_connect=returned"
      : "/partner/dashboard?stripe_connect=returned";
    return Response.redirect(new URL(destination, request.url), 303);
  } catch (error) {
    return onboardingError(error);
  }
}
