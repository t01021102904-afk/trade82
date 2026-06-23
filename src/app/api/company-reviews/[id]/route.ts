import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();

    const { id } = await params;
    await getDb().companyReview.update({
      where: { id },
      data: { deletedAt: new Date(), isPublic: false },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
