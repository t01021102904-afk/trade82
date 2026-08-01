import { SupplierApplicationStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, enumField, idParam, rateLimitOrResponse, readJsonObject, stringField } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { transitionSupplierApplication } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({ request, scope: "admin-supplier-application-transition", userId: admin.id, limit: 80, windowMs: 60 * 60_000 });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    const { id } = await context.params;
    const application = await transitionSupplierApplication({
      applicationId: idParam(id),
      actorUserId: admin.id,
      actor: "ADMIN",
      targetStatus: enumField(body, "targetStatus", Object.values(SupplierApplicationStatus)),
      reason: stringField(body, "reason", { max: 4_000, fallback: null }),
    });
    return Response.json({ application });
  } catch (error) {
    return apiError(error);
  }
}
