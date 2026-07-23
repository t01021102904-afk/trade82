import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { markPartnerPayoutSent, setPartnerPayoutStatus } from "@/lib/partner-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const fields = new Set([
  "action",
  "failureReason",
  "externalTransferReference",
  "confirmation",
  "externalBankReference",
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-partner-payout-write",
      userId: user.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, fields);
    const payoutId = idParam((await params).id, "partnerPayoutId");
    const action = stringField(body, "action", { max: 32, required: true });
    if (action === "hold" || action === "processing" || action === "failed" || action === "returned") {
      await setPartnerPayoutStatus({
        payoutId,
        actorUserId: user.id,
        status:
          action === "hold"
            ? "HOLD"
            : action === "processing"
              ? "PROCESSING"
              : action === "returned"
                ? "RETURNED"
                : "FAILED",
        failureReason: stringField(body, "failureReason", { max: 1_000, required: action === "failed" || action === "returned", fallback: null }) ?? undefined,
      });
      return Response.json({ ok: true }, { headers: noStore });
    }
    if (action === "mark_sent") {
      const result = await markPartnerPayoutSent({
        payoutId,
        actorUserId: user.id,
        externalTransferReference: stringField(body, "externalTransferReference", { max: 240, required: true }) as string,
        confirmation: stringField(body, "confirmation", { max: 240, required: true }) as string,
        externalBankReference: stringField(body, "externalBankReference", { max: 240, fallback: null }) || undefined,
      });
      return Response.json(
        { ok: true, alreadySent: result.alreadySent },
        { headers: noStore },
      );
    }
    throw validationError("Partner payout action is invalid.");
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
