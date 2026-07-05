import { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isActiveSellerSupportSubscription } from "@/lib/seller-support";
import {
  getOrCreateTrade82SupportTeamCompany,
  TRADE82_SUPPORT_TEAM_NAME,
} from "@/lib/support-team-company";

export const runtime = "nodejs";

function isSerializableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function findOrCreateSupportInquiry({
  sellerCompanyId,
  sellerUserId,
  supportCompanyId,
}: {
  sellerCompanyId: string;
  sellerUserId: string;
  supportCompanyId: string;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await getDb().$transaction(
        async (tx) => {
          const existing = await tx.inquiry.findFirst({
            where: {
              buyerCompanyId: supportCompanyId,
              sellerCompanyId,
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          });
          if (existing) return existing;

          return tx.inquiry.create({
            data: {
              buyerCompanyId: supportCompanyId,
              sellerCompanyId,
              productId: null,
              senderUserId: sellerUserId,
              recipientCompanyId: supportCompanyId,
              message: TRADE82_SUPPORT_TEAM_NAME,
              quantity: null,
              targetDate: null,
            },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableTransactionError(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Seller company profile is required before Seller Support." },
        { status: 403 },
      );
    }
    if (
      !isActiveSellerSupportSubscription(
        company.sellerSupportStatus,
        company.sellerSupportPlan,
      )
    ) {
      return Response.json(
        {
          error: "An active Seller Support plan is required.",
          action: "view_plans",
          pricingPath: "/pricing",
        },
        { status: 402 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "seller-support-conversation",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const supportCompany = await getOrCreateTrade82SupportTeamCompany();
    if (!supportCompany) {
      return Response.json(
        {
          error:
            "Trade82 Support Team account is not configured. Add an admin user profile and a buyer company named Trade82 Support Team.",
        },
        { status: 503 },
      );
    }

    const inquiry = await findOrCreateSupportInquiry({
      sellerCompanyId: company.id,
      sellerUserId: user.id,
      supportCompanyId: supportCompany.id,
    });

    return Response.json({
      inquiryId: inquiry.id,
      messageRoute: `/messages?inquiryId=${inquiry.id}`,
    });
  } catch (error) {
    return apiError(error);
  }
}
