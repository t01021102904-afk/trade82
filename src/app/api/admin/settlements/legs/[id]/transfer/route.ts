import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { executeSettlementLegTransfer } from "@/lib/stripe-connect-transfer-execution";
import { settlementTransferHttpStatus } from "@/lib/stripe-connect-transfer-response";
import { getStripeConnectTransferExecutionMode } from "@/lib/stripe-connect-transfer-execution-mode";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const settlementLegId = idParam((await params).id, "settlementLegId");
    if (getStripeConnectTransferExecutionMode() !== "manual") {
      return Response.json({ ok: false, settlementLegId, status: "disabled", retryable: false, errorCode: "transfer_execution_disabled" }, { status: 403 });
    }
    const result = await executeSettlementLegTransfer({
      settlementLegId,
      actorUserId: user.id,
    });

    const status = settlementTransferHttpStatus(result);
    return Response.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
