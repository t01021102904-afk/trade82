import { SupplierApplicationSection, SupplierApplicationStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, enumField, idParam, rateLimitOrResponse, readJsonObject, requiredStringField } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { createSupplierInformationRequest } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };
const requestStatuses = [
  SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
  SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
  SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED,
] as const;

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({ request, scope: "admin-supplier-application-information-request", userId: admin.id, limit: 60, windowMs: 60 * 60_000 });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    const { id } = await context.params;
    const application = await createSupplierInformationRequest({
      applicationId: idParam(id),
      adminUserId: admin.id,
      section: enumField(body, "section", Object.values(SupplierApplicationSection)),
      message: requiredStringField(body, "message", 4_000),
      targetStatus: enumField(body, "targetStatus", requestStatuses),
    });
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
