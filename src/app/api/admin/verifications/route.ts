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
import { getDb } from "@/lib/db";

async function requireDatabaseAdmin() {
  return requireAdmin();
}

export async function GET() {
  try {
    await requireDatabaseAdmin();
    const [requests, reviews] = await Promise.all([
      getDb().verificationRequest.findMany({
        include: {
          company: {
            include: { owner: true, sellerProfile: true, buyerProfile: true },
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
      requests: requests.map(
        ({ documentPath: _documentPath, documentUrl: _documentUrl, ...item }) => {
          void _documentPath;
          void _documentUrl;
          return item;
        },
      ),
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
      getDb().company.update({
        where: { id: verificationRequest.companyId },
        data: { verificationStatus },
      }),
    ]);

    return Response.json({ ok: true, verificationStatus });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
