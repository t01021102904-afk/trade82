import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { executeSettlementLegTransfer } from "@/lib/stripe-connect-transfer-execution";
import { settlementTransferHttpStatus } from "@/lib/stripe-connect-transfer-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const settlementLegId = idParam((await params).id, "settlementLegId");
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
