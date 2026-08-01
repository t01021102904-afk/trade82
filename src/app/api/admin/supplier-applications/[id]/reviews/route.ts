import { SupplierApplicationSection, SupplierReviewStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, enumField, idParam, rateLimitOrResponse, readJsonObject, stringField } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { recordSupplierApplicationReview } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({ request, scope: "admin-supplier-application-review", userId: admin.id, limit: 120, windowMs: 60 * 60_000 });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    const { id } = await context.params;
    const review = await recordSupplierApplicationReview({
      applicationId: idParam(id),
      adminUserId: admin.id,
      section: enumField(body, "section", Object.values(SupplierApplicationSection)),
      status: enumField(body, "status", Object.values(SupplierReviewStatus)),
      notes: stringField(body, "notes", { max: 4_000, fallback: "" }) ?? "",
    });
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
