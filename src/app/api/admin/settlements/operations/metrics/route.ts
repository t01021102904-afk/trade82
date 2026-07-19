import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getSettlementOperationsMetrics } from "@/lib/settlement-operations-control-plane";

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ ok: true, ...(await getSettlementOperationsMetrics()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
