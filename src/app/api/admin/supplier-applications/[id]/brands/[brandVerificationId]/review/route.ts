import {
  SupplierBrandVerificationStatus,
  SupplierReviewStatus,
} from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  enumField,
  idParam,
  nullableStringField,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  stringArrayField,
  validationError,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { reviewSupplierBrandVerification } from "@/lib/supplier-application";

type RouteContext = {
  params: Promise<{ id: string; brandVerificationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-supplier-brand-review",
      userId: admin.id,
      limit: 120,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    rejectUnexpectedFields(
      body,
      new Set([
        "status",
        "evidenceStatus",
        "reviewNotes",
        "expiresAt",
        "countryRestrictions",
        "reason",
      ]),
    );
    const expiresAtValue = nullableStringField(body, "expiresAt", 64);
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime()))
      throw validationError("expiresAt is invalid.");
    const { id, brandVerificationId } = await context.params;
    const brand = await reviewSupplierBrandVerification({
      applicationId: idParam(id),
      brandVerificationId: idParam(brandVerificationId, "brandVerificationId"),
      adminUserId: admin.id,
      input: {
        status: enumField(
          body,
          "status",
          Object.values(SupplierBrandVerificationStatus),
        ),
        evidenceStatus: enumField(
          body,
          "evidenceStatus",
          Object.values(SupplierReviewStatus),
        ),
        reviewNotes: nullableStringField(body, "reviewNotes", 4_000) ?? "",
        expiresAt,
        countryRestrictions: stringArrayField(body, "countryRestrictions", {
          maxItems: 100,
          maxLength: 100,
        }),
        reason: requiredStringField(body, "reason", 4_000),
      },
    });
    return Response.json({ brand });
  } catch (error) {
    return apiError(error);
  }
}
