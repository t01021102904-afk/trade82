import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { acknowledgeSettlementAlert } from "@/lib/settlement-operations-control-plane";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    const alertId = idParam((await params).id, "alertId");
    const body = await request.json().catch(() => ({}));
    const result = await acknowledgeSettlementAlert({ alertId, actorUserId: user.id, resolve: body?.action === "resolve" });
    return Response.json(result, { status: result.ok ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
