import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const reviews = await getDb().companyReview.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        reviewerCompany: { select: { companyRole: true } },
        reviewedCompany: {
          select: { legalName: true, tradeName: true, companyRole: true },
        },
      },
    });

    return Response.json({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewerCompanyRole: review.reviewerCompany.companyRole,
        reviewedCompany: review.reviewedCompany,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
