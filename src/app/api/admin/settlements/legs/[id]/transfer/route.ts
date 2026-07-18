import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { executeSettlementLegTransfer } from "@/lib/stripe-connect-transfer-execution";

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

    const status = result.status === "disabled"
      ? 403
      : result.status === "ineligible"
        ? 409
        : 200;
    return Response.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
