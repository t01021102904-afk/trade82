import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-company-reviews-delete",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "reviewId");
    await getDb().companyReview.update({
      where: { id },
      data: { deletedAt: new Date(), isPublic: false },
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
