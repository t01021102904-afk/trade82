import { auth } from "@clerk/nextjs/server";

import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  requiredIdField,
  requiredStringField,
  validationErrorResponse,
} from "@/lib/api-security";
import {
  canViewPublicCompany,
  requireAuth,
} from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = idParam(url.searchParams.get("companyId") ?? "", "companyId");


    const company = await getDb().company.findUnique({
      where: { id: companyId },
      select: { id: true, companyRole: true, verificationStatus: true },
    });

    if (!company || !canViewPublicCompany(company)) {
      return Response.json({
        averageRating: 0,
        canReview: false,
        reviews: [],
      });
    }

    const reviews = await getDb().companyReview.findMany({
      where: { reviewedCompanyId: companyId, isPublic: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        reviewerCompany: {
          select: { companyRole: true },
        },
      },
    });

    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    const canReview = await currentViewerCanReview(company);

    return Response.json({
      companyRole: company.companyRole,
      averageRating,
      canReview,
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewerCompanyRole: review.reviewerCompany.companyRole,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

async function currentViewerCanReview(company: {
  id: string;
  companyRole: "seller" | "buyer";
}) {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await getDb().userProfile.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) return false;

  const reviewerCompanyRole =
    company.companyRole === "seller" ? "buyer" : "seller";
  const reviewerCompany = await getDb().company.findFirst({
    where: {
      ownerUserId: user.id,
      companyRole: reviewerCompanyRole,
    },
    select: { id: true },
  });
  if (!reviewerCompany) return false;

  const completedDeal = await getDb().deal.findFirst({
    where: {
      dealStatus: "completed",
      OR: [
        {
          buyerCompanyId: reviewerCompany.id,
          sellerCompanyId: company.id,
        },
        {
          sellerCompanyId: reviewerCompany.id,
          buyerCompanyId: company.id,
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(completedDeal);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "company-reviews",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
      message: "Too many review attempts. Please try again shortly.",
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const reviewedCompanyId = requiredIdField(body, "reviewedCompanyId");
    const rating = Number(body.rating);
    const comment = requiredStringField(body, "comment", 2_000);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const reviewedCompany = await getDb().company.findUnique({
      where: { id: reviewedCompanyId },
      select: { id: true, companyRole: true, verificationStatus: true },
    });

    if (!reviewedCompany || !canViewPublicCompany(reviewedCompany)) {
      return Response.json({ error: "Company not found." }, { status: 404 });
    }

    const reviewerCompanyRole =
      reviewedCompany.companyRole === "seller" ? "buyer" : "seller";

    const reviewerCompany = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        companyRole: reviewerCompanyRole,
      },
      select: { id: true },
    });

    if (!reviewerCompany) {
      return Response.json(
        { error: "You need the opposite company role to leave this review." },
        { status: 403 },
      );
    }

    const completedDeal = await getDb().deal.findFirst({
      where: {
        dealStatus: "completed",
        OR: [
          {
            buyerCompanyId: reviewerCompany.id,
            sellerCompanyId: reviewedCompanyId,
          },
          {
            sellerCompanyId: reviewerCompany.id,
            buyerCompanyId: reviewedCompanyId,
          },
        ],
      },
      select: { id: true },
    });
    if (!completedDeal) {
      return Response.json(
        { error: "A completed deal is required to leave a review." },
        { status: 403 },
      );
    }

    const review = await getDb().companyReview.create({
      data: {
        reviewerCompanyId: reviewerCompany.id,
        reviewedCompanyId,
        rating,
        comment,
      },
    });

    return Response.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
