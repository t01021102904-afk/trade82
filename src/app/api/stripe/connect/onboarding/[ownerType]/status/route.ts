import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import {
  getStripeConnectOnboardingStatus,
  isStripeConnectOwnerType,
  StripeConnectOnboardingError,
} from "@/lib/stripe-connect-onboarding";
import { getStripeConnectOnboardingMode } from "@/lib/stripe-connect-onboarding-feature";

function ownerTypeFromParams(value: string) {
  if (!isStripeConnectOwnerType(value)) {
    throw new StripeConnectOnboardingError("Not found.", 404);
  }
  return value;
}

function onboardingError(error: unknown) {
  if (error instanceof StripeConnectOnboardingError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ownerType: string }> },
) {
  try {
    const user = await requireAuth();
    const ownerType = ownerTypeFromParams((await params).ownerType);
    if (ownerType === "partner") {
      return Response.json(
        { enabled: false, account: null, error: "Partner manual payout review is used instead of Stripe onboarding." },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (getStripeConnectOnboardingMode() === "off") {
      return Response.json({ enabled: false, account: null });
    }

    const account = await getStripeConnectOnboardingStatus({
      userId: user.id,
      ownerType,
    });
    return Response.json({ enabled: true, account });
  } catch (error) {
    return onboardingError(error);
  }
}
