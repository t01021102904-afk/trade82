import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  idField,
  numberStringField,
  rateLimitOrResponse,
  readJsonObject,
  requiredIdField,
  stringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const deals = await getDb().deal.findMany({
      where: {
        OR: [
          { buyerCompany: { ownerUserId: user.id, deletedAt: null } },
          { sellerCompany: { ownerUserId: user.id, deletedAt: null } },
        ],
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        reviews: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(
      deals.map((deal) => ({
        ...deal,
        contractFilePath: undefined,
        hasContractFile: Boolean(deal.contractFilePath),
        contractValue: deal.contractValue.toString(),
        reviews: deal.reviews.map((review) => ({
          ...review,
          contractValue: review.contractValue.toString(),
        })),
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "deals",
      userId: user.id,
      limit: 40,
      windowMs: 60 * 60_000,
      message: "Too many deal updates. Please try again shortly.",
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const inquiryId = idField(body, "inquiryId");
    const inquiry = inquiryId
      ? await getDb().inquiry.findFirst({
          where: {
            id: inquiryId,
            OR: [
              { buyerCompany: { ownerUserId: user.id, deletedAt: null } },
              { sellerCompany: { ownerUserId: user.id, deletedAt: null } },
            ],
          },
          include: { buyerCompany: true, sellerCompany: true },
        })
      : null;
    if (inquiryId && !inquiry) {
      return Response.json({ error: "Inquiry not found." }, { status: 404 });
    }

    const existingDeal = inquiryId
      ? await getDb().deal.findFirst({
          where: {
            inquiryId,
            buyerCompany: { deletedAt: null },
            sellerCompany: { deletedAt: null },
            product: { deletedAt: null },
          },
          include: {
            buyerCompany: true,
            sellerCompany: true,
            product: true,
            reviews: true,
          },
        })
      : null;
    if (existingDeal) {
      return Response.json(serializeDeal(existingDeal));
    }

    const buyerCompanyId =
      inquiry?.buyerCompanyId ?? requiredIdField(body, "buyerCompanyId");
    const sellerCompanyId =
      inquiry?.sellerCompanyId ?? requiredIdField(body, "sellerCompanyId");
    const participant = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        deletedAt: null,
        id: { in: [buyerCompanyId, sellerCompanyId] },
      },
    });
    if (!participant) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const companies = inquiry
      ? [inquiry.buyerCompany, inquiry.sellerCompany]
      : await getDb().company.findMany({
          where: { id: { in: [buyerCompanyId, sellerCompanyId] } },
        });
    const buyerCompany = companies.find((company) => company.id === buyerCompanyId);
    const sellerCompany = companies.find((company) => company.id === sellerCompanyId);
    if (!buyerCompany || !sellerCompany || buyerCompany.ownerUserId === sellerCompany.ownerUserId) {
      return Response.json({ error: "Invalid deal participants." }, { status: 400 });
    }

    const deal = await getDb().deal.create({
      data: {
        inquiryId,
        buyerCompanyId,
        sellerCompanyId,
        productId: inquiry?.productId ?? idField(body, "productId"),
        contractTitle:
          stringField(body, "contractTitle", { max: 160, fallback: null }) ||
          "Deal discussion",
        contractValue: numberStringField(body, "contractValue", {
          min: 0,
          max: 999_999_999_999,
          fallback: "0",
        }) ?? "0",
        currency:
          stringField(body, "currency", { max: 8, fallback: null }) || "USD",
        dealStatus: "in_progress",
        completedAt: null,
        createdByUserId: user.id,
        confirmedByBuyer: false,
        confirmedBySeller: false,
        isPublic: body.isPublic === true,
        publicValueDisplay:
          enumField(
            body,
            "publicValueDisplay",
            ["hidden", "exact", "range"] as const,
            "hidden",
          ),
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        reviews: true,
      },
    });
    return Response.json(serializeDeal(deal), { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}

function serializeDeal<T extends {
  contractFilePath: string | null;
  contractValue: { toString(): string };
  reviews: Array<{ contractValue?: { toString(): string } }>;
}>(deal: T) {
  return {
    ...deal,
    contractFilePath: undefined,
    hasContractFile: Boolean(deal.contractFilePath),
    contractValue: deal.contractValue.toString(),
    reviews: deal.reviews.map((review) => ({
      ...review,
      contractValue: review.contractValue?.toString(),
    })),
  };
}
