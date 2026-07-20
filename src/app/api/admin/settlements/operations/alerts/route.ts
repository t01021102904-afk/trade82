import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const alerts = await getDb().settlementOperationalAlert.findMany({ orderBy: { lastOccurredAt: "desc" }, take: 100 });
    return Response.json({ ok: true, alerts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
