import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idField,
  nullableStringField,
  rateLimitOrResponse,
  readJsonObject,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { isAdminUser, requireAuth } from "@/lib/authz";
import {
  getOrCreateTrade82TeamCompany,
  isTrade82TeamCompanyName,
} from "@/lib/admin-team-company";
import { getDb } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/message-email-notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrade82TeamAccount } from "@/lib/trade82-team";

export async function GET() {
  try {
    const user = await requireAuth();
    const admin = await isAdminUser();
    const viewerCompanies = await getDb().company.findMany({
      where: { ownerUserId: user.id },
      select: { id: true },
    });
    const inquiries = await getDb().inquiry.findMany({
      where: {
        OR: [
          { senderUserId: user.id },
          { recipientCompany: { ownerUserId: user.id } },
          ...(admin
            ? [
                {
                  buyerCompany: {
                    OR: [{ legalName: "Trade82 team" }, { tradeName: "Trade82 team" }],
                  },
                },
                {
                  sellerCompany: {
                    OR: [{ legalName: "Trade82 team" }, { tradeName: "Trade82 team" }],
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        buyerCompany: {
          include: {
            owner: { select: { email: true, role: true } },
          },
        },
        sellerCompany: {
          include: {
            owner: { select: { email: true, role: true } },
          },
        },
        product: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            attachments: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        deals: {
          orderBy: { updatedAt: "desc" },
          include: { reviews: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    const viewerCompanyIds = [
      ...viewerCompanies.map((company) => company.id),
      ...(admin
        ? inquiries.flatMap((inquiry) =>
            [inquiry.buyerCompany, inquiry.sellerCompany]
              .filter((company) =>
                isTrade82TeamCompanyName(company.tradeName || company.legalName),
              )
              .map((company) => company.id),
          )
        : []),
    ];
    return Response.json(
      inquiries.map((inquiry) => ({
        ...inquiry,
        buyerCompany: publicThreadCompany(inquiry.buyerCompany),
        sellerCompany: publicThreadCompany(inquiry.sellerCompany),
        viewerCompanyIds,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

function publicThreadCompany<T extends { owner: { email: string; role: string } }>(
  company: T,
) {
  const { owner, ...publicCompany } = company;
  return {
    ...publicCompany,
    isTrade82Team: isTrade82TeamAccount(owner),
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const admin = await isAdminUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "inquiries",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
      message: "Too many inquiries. Please wait before sending more.",
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const productId = idField(body, "productId");
    const explicitTargetCompanyId =
      idField(body, "targetCompanyId") ??
      idField(body, "sellerCompanyId") ??
      idField(body, "buyerCompanyId");
    const message = stringField(body, "message", { max: 2_000, fallback: "" }) ?? "";
    const quantity = nullableStringField(body, "quantity", 120);
    const targetDateRaw = nullableStringField(body, "targetDate", 40);
    const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;
    if (targetDateRaw && Number.isNaN(targetDate?.getTime())) {
      throw validationError("targetDate is invalid.");
    }

    const product = productId
      ? await getDb().product.findFirst({
          where: {
            id: productId,
            ...(admin ? {} : { status: "active" }),
          },
          include: { sellerCompany: true },
        })
      : null;
    const targetCompanyId = product?.sellerCompanyId ?? explicitTargetCompanyId;

    if (!targetCompanyId) {
      return Response.json(
        { error: "Select a company before starting a conversation.", code: "missing_target" },
        { status: 400 },
      );
    }

    if (product && explicitTargetCompanyId && explicitTargetCompanyId !== product.sellerCompanyId) {
      return Response.json(
        { error: "The selected product does not belong to this company.", code: "invalid_product_target" },
        { status: 400 },
      );
    }

    const targetCompany = product?.sellerCompany ?? await getDb().company.findUnique({
      where: { id: targetCompanyId },
    });
    if (
      !targetCompany ||
      (!admin && targetCompany.verificationStatus !== "verified")
    ) {
      return Response.json(
        { error: "This company is not available for contact.", code: "target_unavailable" },
        { status: 404 },
      );
    }

    if (!admin && targetCompany.ownerUserId === user.id) {
      return Response.json(
        { error: "You cannot contact your own company.", code: "own_company" },
        { status: 409 },
      );
    }

    const senderRole = targetCompany.companyRole === "seller" ? "buyer" : "seller";
    const senderCompany = admin
      ? await getOrCreateTrade82TeamCompany(user.id, senderRole)
      : await getDb().company.findFirst({
          where: {
            ownerUserId: user.id,
            companyRole: senderRole,
          },
        });

    if (!senderCompany) {
      return Response.json(
        {
          error: "Complete your company profile before contacting companies.",
          code: "complete_profile",
          action: "complete_profile",
          role: senderRole,
        },
        { status: 409 },
      );
    }

    const buyerCompany =
      targetCompany.companyRole === "seller" ? senderCompany : targetCompany;
    const sellerCompany =
      targetCompany.companyRole === "seller" ? targetCompany : senderCompany;

    const existingInquiry = await getDb().inquiry.findFirst({
      where: {
        buyerCompanyId: buyerCompany.id,
        sellerCompanyId: sellerCompany.id,
        productId,
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            attachments: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    if (existingInquiry) {
      return Response.json({
        ...existingInquiry,
        messageRoute: `/messages?inquiryId=${existingInquiry.id}`,
      });
    }

    const companyLimit = checkRateLimit(`inquiries:${user.id}:${targetCompany.id}`, 30, 24 * 60 * 60_000);
    if (!companyLimit.allowed) {
      return Response.json(
        { error: "You have already sent several inquiries to this company. Please wait before sending more." },
        { status: 429, headers: { "Retry-After": String(companyLimit.retryAfterSeconds) } },
      );
    }

    const inquiry = await getDb().inquiry.create({
      data: {
        buyerCompanyId: buyerCompany.id,
        sellerCompanyId: sellerCompany.id,
        productId,
        senderUserId: user.id,
        recipientCompanyId: targetCompany.id,
        message,
        quantity,
        targetDate,
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            attachments: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    await sendNewMessageNotification({
      messageId: `inquiry-${inquiry.id}`,
      inquiryId: inquiry.id,
      senderUserId: user.id,
      senderCompanyName: senderCompany.tradeName || senderCompany.legalName,
      receiverCompanyId: inquiry.recipientCompanyId,
      body: inquiry.message,
      attachmentCount: 0,
    }).catch((error) => {
      console.error("Message notification email failed.", {
        name: error instanceof Error ? error.name : typeof error,
      });
    });

    return Response.json(
      { ...inquiry, messageRoute: `/messages?inquiryId=${inquiry.id}` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
