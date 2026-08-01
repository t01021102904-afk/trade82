import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { resolveSupplierInformationRequest } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string; requestId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-supplier-information-resolution",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["resolutionNote"]));
    const { id, requestId } = await context.params;
    const informationRequest = await resolveSupplierInformationRequest({
      applicationId: idParam(id),
      requestId: idParam(requestId, "requestId"),
      adminUserId: admin.id,
      resolutionNote: requiredStringField(body, "resolutionNote", 4_000),
    });
    return Response.json({ informationRequest });
  } catch (error) {
    return apiError(error);
  }
}
