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
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireAuth();
    const viewerCompanies = await getDb().company.findMany({
      where: { ownerUserId: user.id },
      select: { id: true },
    });
    const viewerCompanyIds = viewerCompanies.map((company) => company.id);
    const inquiries = await getDb().inquiry.findMany({
      where: {
        OR: [
          { senderUserId: user.id },
          { recipientCompany: { ownerUserId: user.id } },
        ],
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
        deals: {
          orderBy: { updatedAt: "desc" },
          include: { reviews: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(
      inquiries.map((inquiry) => ({ ...inquiry, viewerCompanyIds })),
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
          where: { id: productId, status: "active" },
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
    if (!targetCompany || targetCompany.verificationStatus !== "verified") {
      return Response.json(
        { error: "This company is not available for contact.", code: "target_unavailable" },
        { status: 404 },
      );
    }

    if (targetCompany.ownerUserId === user.id) {
      return Response.json(
        { error: "You cannot contact your own company.", code: "own_company" },
        { status: 409 },
      );
    }

    const senderRole = targetCompany.companyRole === "seller" ? "buyer" : "seller";
    const senderCompany = await getDb().company.findFirst({
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
