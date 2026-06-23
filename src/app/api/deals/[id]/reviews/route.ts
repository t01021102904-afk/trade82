import { apiError } from "@/lib/api-response";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const deal = await getDb().deal.findUnique({ where: { id } });
    if (!deal || deal.dealStatus !== "completed") {
      return Response.json(
        { error: "Only completed deals can be reviewed." },
        { status: 400 },
      );
    }
    const reviewer = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        id: { in: [deal.buyerCompanyId, deal.sellerCompanyId] },
      },
    });
    if (!reviewer) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json(
        { error: "Rating must be between 1 and 5." },
        { status: 400 },
      );
    }
    const reviewedCompanyId =
      reviewer.id === deal.buyerCompanyId
        ? deal.sellerCompanyId
        : deal.buyerCompanyId;
    const review = await getDb().review.create({
      data: {
        dealId: deal.id,
        reviewerCompanyId: reviewer.id,
        reviewedCompanyId,
        rating,
        reviewTitle: String(body.reviewTitle ?? "") || null,
        reviewText: String(body.reviewText ?? ""),
        contractValue: deal.contractValue,
        currency: deal.currency,
        publicValueDisplay:
          body.publicValueDisplay === "exact" ||
          body.publicValueDisplay === "range"
            ? body.publicValueDisplay
            : "hidden",
        isPublic: body.isPublic !== false,
        adminApproved: false,
      },
    });
    return Response.json(
      { ...review, contractValue: review.contractValue.toString() },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
