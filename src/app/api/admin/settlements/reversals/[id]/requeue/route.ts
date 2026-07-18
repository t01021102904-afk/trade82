import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { requeueSettlementReversal } from "@/lib/stripe-connect-transfer-reversal-execution";
import { settlementReversalHttpStatus } from "@/lib/stripe-connect-transfer-reversal-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const settlementReversalId = idParam((await params).id, "settlementReversalId");
    const result = await requeueSettlementReversal({
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
