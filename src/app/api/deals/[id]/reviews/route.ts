import { apiError } from "@/lib/api-response";
import { Prisma } from "@/generated/prisma/client";
import {
  ApiValidationError,
  enumField,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  requiredStringField,
  stringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "deal-reviews",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
      message: "Too many review attempts. Please try again shortly.",
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "dealId");
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
    const body = await readJsonObject(request);
    const rating = Number(body.rating);
    const reviewText = requiredStringField(body, "reviewText", 2_000);
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
        reviewTitle:
          stringField(body, "reviewTitle", { max: 160, fallback: null }) ||
          null,
        reviewText,
        contractValue: deal.contractValue,
        currency: deal.currency,
        publicValueDisplay:
          enumField(
            body,
            "publicValueDisplay",
            ["hidden", "exact", "range"] as const,
            "hidden",
          ),
        isPublic: body.isPublic !== false,
        adminApproved: false,
      },
    });
    return Response.json(
      { ...review, contractValue: review.contractValue.toString() },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "You have already submitted a review for this deal." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
