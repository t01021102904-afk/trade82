import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  rateLimitOrResponse,
  readJsonObject,
  requiredIdField,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import {
  sendCompanyApprovalEmail,
  shouldSendCompanyApprovalEmail,
} from "@/lib/company-approval-email";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";

async function requireDatabaseAdmin() {
  return requireAdmin();
}

export async function GET(request: Request) {
  try {
    await requireDatabaseAdmin();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "pending";

    const statusWhere =
      filter === "pending"
        ? ({ status: "pending_review" } as const)
        : filter === "listed"
          ? ({ status: "verified" } as const)
          : filter === "rejected"
            ? ({ status: "rejected" } as const)
            : {};

    const [requests, reviews] = await Promise.all([
      getDb().verificationRequest.findMany({
        where: {
          ...statusWhere,
          company: {
            companyRole: "seller",
            legalName: { not: DELETED_COMPANY_NAME },
          },
        },
        select: {
          id: true,
          status: true,
          adminNote: true,
          documentFilename: true,
          createdAt: true,
          reviewedAt: true,
          company: {
            select: {
              id: true,
              legalName: true,
              tradeName: true,
              companyRole: true,
              website: true,
              businessAddress: true,
              country: true,
              stateOrProvince: true,
              city: true,
              description: true,
              categories: true,
              verificationStatus: true,
              logoOriginalUrl: true,
              logoThumbnailUrl: true,
              logoUrl: true,
              useDefaultLogo: true,
              owner: {
                select: {
                  email: true,
                  displayName: true,
                },
              },
              sellerProfile: true,
              buyerProfile: true,
              _count: {
                select: {
                  products: true,
                  buyerInquiries: true,
                  sellerInquiries: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      getDb().review.findMany({
        where: { adminApproved: false },
        include: { reviewerCompany: true, reviewedCompany: true, deal: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return Response.json({
      requests,
      reviews: reviews.map((review) => ({
        ...review,
        contractValue: review.contractValue.toString(),
        deal: {
          ...review.deal,
          contractValue: review.deal.contractValue.toString(),
        },
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireDatabaseAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-verifications-write",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);

    if (body.action === "review") {
      const reviewId = requiredIdField(body, "reviewId");
      const approved = body.approved === true;
      await getDb().review.update({
        where: { id: reviewId },
        data: { adminApproved: approved, isPublic: approved },
      });
      return Response.json({ ok: true });
    }

    const requestId = requiredIdField(body, "requestId");
    if (
      body.verificationStatus !== "verified" &&
      body.verificationStatus !== "rejected"
    ) {
      throw validationError("verificationStatus is invalid.");
    }
    const verificationStatus = body.verificationStatus;
    const verificationRequest = await getDb().verificationRequest.findUnique({
      where: { id: requestId },
      include: { company: { include: { owner: true } } },
    });
    if (!verificationRequest) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const shouldSendApprovalEmail = shouldSendCompanyApprovalEmail({
      companyRole: verificationRequest.company.companyRole,
      companyVerificationStatus: verificationRequest.company.verificationStatus,
      verificationRequestStatus: verificationRequest.status,
      nextVerificationStatus: verificationStatus,
      ownerEmail: verificationRequest.company.owner.email,
    });

    await getDb().$transaction([
      getDb().verificationRequest.update({
        where: { id: requestId },
        data: {
          status: verificationStatus,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
          adminNote:
            stringField(body, "adminNote", { max: 2_000, fallback: undefined }) ??
            undefined,
        },
      }),
      getDb().verificationRequest.updateMany({
        where: {
          companyId: verificationRequest.companyId,
          id: { not: requestId },
          status: "pending_review",
        },
        data: {
          status: verificationStatus,
          reviewedByUserId: admin.id,
          reviewedAt: new Date(),
        },
      }),
      getDb().company.update({
        where: { id: verificationRequest.companyId },
        data: { verificationStatus },
      }),
    ]);

    const emailSent = shouldSendApprovalEmail
      ? await sendCompanyApprovalEmail({
          verificationRequestId: verificationRequest.id,
          ownerEmail: verificationRequest.company.owner.email,
          preferredLanguage: verificationRequest.company.owner.preferredLanguage,
        })
      : false;

    return Response.json({ ok: true, verificationStatus, emailSent });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
