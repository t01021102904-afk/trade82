import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam, rateLimitOrResponse, readJsonObject } from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import {
  getSupplierApplicationForApplicant,
  parseSupplierApplicationUpdateInput,
  supplierApplicationSafeResponse,
  updateSupplierApplication,
} from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const application = await getSupplierApplicationForApplicant(idParam(id), user.id);
    return Response.json(
      { application: supplierApplicationSafeResponse(application) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({ request, scope: "supplier-application-update", userId: user.id, limit: 80, windowMs: 60 * 60_000 });
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const application = await updateSupplierApplication({
      applicationId: idParam(id),
      userId: user.id,
      input: parseSupplierApplicationUpdateInput(await readJsonObject(request)),
    });
    return Response.json({ application });
  } catch (error) {
    return apiError(error);
  }
}
