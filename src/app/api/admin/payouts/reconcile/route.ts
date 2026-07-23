import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  assertSameOrigin,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { preparePartnerPayoutForSettlementLeg } from "@/lib/partner-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-payout-reconcile",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["settlementLegId"]));
    const settlementLegId = stringField(body, "settlementLegId", { max: 80, required: true });
    const payout = await preparePartnerPayoutForSettlementLeg({
      settlementLegId: settlementLegId as string,
      actorUserId: user.id,
    });
    return Response.json({ ok: true, payoutId: payout.id, status: payout.status }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
