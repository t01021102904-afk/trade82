import { requireAuth } from "@/lib/authz";
import { apiError } from "@/lib/api-response";
import {
  getSellerStripeMerchantAccountStatus,
  getStripeDirectChargeMerchantOnboardingMode,
  StripeDirectChargeMerchantError,
} from "@/lib/stripe-direct-charge-merchant";

function merchantError(error: unknown) {
  if (error instanceof StripeDirectChargeMerchantError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return apiError(error);
}

export async function GET() {
  try {
    const user = await requireAuth();
    if (getStripeDirectChargeMerchantOnboardingMode() !== "on") {
      return Response.json(
        { enabled: false, account: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const account = await getSellerStripeMerchantAccountStatus({ userId: user.id });
    return Response.json(
      { enabled: true, account },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return merchantError(error);
  }
}
