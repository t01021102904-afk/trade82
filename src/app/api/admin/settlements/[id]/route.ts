import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  validationError,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import {
  approveSettlementRelease,
  holdSettlementRelease,
  reevaluateSettlementRelease,
} from "@/lib/stripe-connect-settlement-release";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const settlementId = idParam((await params).id, "settlementId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["action", "reason"]));
    const action = requiredStringField(body, "action", 32);

    const result = action === "approve"
      ? await approveSettlementRelease({ settlementId, actorUserId: user.id })
      : action === "hold"
        ? await holdSettlementRelease({
          settlementId,
          actorUserId: user.id,
          reason: requiredStringField(body, "reason", 1000),
        })
        : action === "reevaluate"
          ? await reevaluateSettlementRelease({ settlementId, actorUserId: user.id })
          : (() => { throw validationError("action is invalid."); })();

    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
