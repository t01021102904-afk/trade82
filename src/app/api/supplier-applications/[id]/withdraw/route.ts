import { SupplierApplicationStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam, rateLimitOrResponse } from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { transitionSupplierApplication } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({ request, scope: "supplier-application-withdraw", userId: user.id, limit: 10, windowMs: 60 * 60_000 });
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const application = await transitionSupplierApplication({
      applicationId: idParam(id),
      actorUserId: user.id,
      actor: "APPLICANT",
      targetStatus: SupplierApplicationStatus.WITHDRAWN,
    });
    return Response.json({ application });
  } catch (error) {
    return apiError(error);
  }
}
