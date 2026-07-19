import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { executeSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-execution";
import { settlementReversalHttpStatus } from "@/lib/stripe-connect-transfer-reversal-response";
import { getStripeConnectTransferReversalExecutionMode } from "@/lib/stripe-connect-transfer-reversal-mode";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const settlementReversalId = idParam((await params).id, "settlementReversalId");
    if (getStripeConnectTransferReversalExecutionMode() !== "manual") {
      return Response.json({ ok: false, settlementReversalId, status: "disabled", retryable: false, errorCode: "reversal_execution_disabled" }, { status: 403 });
    }
    const result = await executeSettlementReversal({
      settlementReversalId,
      actorUserId: user.id,
    });
    return Response.json(result, {
      status: settlementReversalHttpStatus(result),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
