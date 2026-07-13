import { apiError } from "@/lib/api-response";
import { Prisma } from "@/generated/prisma/client";
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
import { sha256Hex } from "@/lib/message-attachments";
import { sendNewMessageNotification } from "@/lib/message-email-notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrade82TeamAccount } from "@/lib/trade82-team";

const inquiryThreadInclude = {
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
} satisfies Prisma.InquiryInclude;

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

function hasContactReadyProfile(company: {
  companyRole: "seller" | "buyer";
  legalName: string;
  buyerProfile: unknown;
  sellerProfile: unknown;
}) {
  if (!company.legalName.trim()) return false;
  if (company.companyRole === "buyer") return Boolean(company.buyerProfile);
  return Boolean(company.sellerProfile);
}

async function findContactReadyCompany(
  ownerUserId: string,
  companyRole: "seller" | "buyer",
) {
  const company = await getDb().company.findFirst({
    where: {
      ownerUserId,
      companyRole,
    },
    include: {
      buyerProfile: true,
      sellerProfile: true,
    },
  });

  return company && hasContactReadyProfile(company) ? company : null;
}

function buildProductInquiryContextMessage({
  productName,
  message,
}: {
  productName?: string;
  message: string;
}) {
  const trimmedMessage = message.trim();
  if (productName && trimmedMessage) {
    return `Product inquiry: ${productName}\n\n${trimmedMessage}`;
  }
  if (productName) return `Product inquiry: ${productName}`;
  return trimmedMessage;
}

function isSerializableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function findOrCreateConversationForParticipants({
  buyerCompany,
  sellerCompany,
  product,
  senderUserId,
  senderCompanyId,
  receiverCompanyId,
  initialRecipientCompanyId,
  message,
  quantity,
  targetDate,
}: {
  buyerCompany: { id: string };
  sellerCompany: { id: string };
  product: { id: string; name: string } | null;
  senderUserId: string;
  senderCompanyId: string;
  receiverCompanyId: string;
  initialRecipientCompanyId: string;
  message: string;
  quantity: string | null;
  targetDate: Date | null;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await getDb().$transaction(
        async (tx) => {
          const existingInquiry = await tx.inquiry.findFirst({
            where: {
              buyerCompanyId: buyerCompany.id,
              sellerCompanyId: sellerCompany.id,
            },
            orderBy: { updatedAt: "desc" },
            include: inquiryThreadInclude,
          });

          if (existingInquiry) {
            const productChanged =
              Boolean(product?.id) && existingInquiry.productId !== product?.id;
            const contextBody = buildProductInquiryContextMessage({
              productName: productChanged ? product?.name : undefined,
              message,
            });

            const contextMessage = contextBody
              ? await tx.message.create({
                  data: {
                    inquiryId: existingInquiry.id,
                    senderUserId,
                    senderCompanyId,
                    receiverCompanyId,
                    body: contextBody,
                    contentHash: sha256Hex(contextBody),
                  },
                })
              : null;

            const updateData: Prisma.InquiryUpdateInput = {};
            if (productChanged && product) {
              updateData.product = { connect: { id: product.id } };
            }
            if (quantity !== null) {
              updateData.quantity = quantity;
            }
            if (targetDate !== null) {
              updateData.targetDate = targetDate;
            }
            if (contextMessage) {
              updateData.updatedAt = new Date();
            }

            const inquiry = Object.keys(updateData).length
              ? await tx.inquiry.update({
                  where: { id: existingInquiry.id },
                  data: updateData,
                  include: inquiryThreadInclude,
                })
              : existingInquiry;

            return {
              inquiry,
              status: 200,
              notification: contextMessage
                ? {
                    messageId: contextMessage.id,
                    inquiryId: existingInquiry.id,
                    receiverCompanyId,
                    body: contextBody,
                  }
                : null,
            };
          }

          const inquiry = await tx.inquiry.create({
            data: {
              buyerCompanyId: buyerCompany.id,
              sellerCompanyId: sellerCompany.id,
              productId: product?.id ?? null,
              senderUserId,
              recipientCompanyId: initialRecipientCompanyId,
              message,
              quantity,
              targetDate,
            },
            include: inquiryThreadInclude,
          });

          return {
            inquiry,
            status: 201,
            notification: {
              messageId: `inquiry-${inquiry.id}`,
              inquiryId: inquiry.id,
              receiverCompanyId: inquiry.recipientCompanyId,
              body: inquiry.message,
            },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
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
      : await findContactReadyCompany(user.id, senderRole);

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

    const existingConversationIntent = await getDb().inquiry.findFirst({
      where: {
        buyerCompanyId: buyerCompany.id,
        sellerCompanyId: sellerCompany.id,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, productId: true },
    });
    const willWriteInquiryContext =
      !existingConversationIntent ||
      Boolean(message.trim()) ||
      quantity !== null ||
      targetDate !== null ||
      (Boolean(product?.id) && existingConversationIntent.productId !== product?.id);

    if (willWriteInquiryContext) {
      const companyLimit = checkRateLimit(`inquiries:${user.id}:${targetCompany.id}`, 30, 24 * 60 * 60_000);
      if (!companyLimit.allowed) {
        return Response.json(
          { error: "You have already sent several inquiries to this company. Please wait before sending more." },
          { status: 429, headers: { "Retry-After": String(companyLimit.retryAfterSeconds) } },
        );
      }
    }

    const result = await findOrCreateConversationForParticipants({
      buyerCompany,
      sellerCompany,
      product,
      senderUserId: user.id,
      senderCompanyId: senderCompany.id,
      receiverCompanyId: targetCompany.id,
      initialRecipientCompanyId: targetCompany.id,
      message,
      quantity,
      targetDate,
    });

    if (result?.notification) {
      await sendNewMessageNotification({
        messageId: result.notification.messageId,
        inquiryId: result.notification.inquiryId,
        senderUserId: user.id,
        senderCompanyName: senderCompany.tradeName || senderCompany.legalName,
        receiverCompanyId: result.notification.receiverCompanyId,
        body: result.notification.body,
        attachmentCount: 0,
      }).catch((error) => {
        console.error("Message notification email failed.", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
    }

    return Response.json(
      { ...result.inquiry, messageRoute: `/messages?inquiryId=${result.inquiry.id}` },
      { status: result.status },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
