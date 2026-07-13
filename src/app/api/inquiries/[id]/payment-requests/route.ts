import { PaymentRequestEventType } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";
import {
  calculatePaymentAmounts,
  parsePaymentDueDate,
  parseUsdMinorUnits,
  paymentRequestConversationSelect,
  PAYMENT_REQUEST_CURRENCY,
} from "@/lib/payment-requests";

const paymentRequestFields = new Set([
  "productName",
  "quantity",
  "unit",
  "productAmount",
  "shippingAmount",
  "paymentDueDate",
  "orderTerms",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "message-payment-request-create",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
      message: "Too many payment requests. Please wait before creating another one.",
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const inquiryId = idParam(rawId, "inquiryId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, paymentRequestFields);

    const productName = stringField(body, "productName", { max: 240, required: true }) as string;
    const quantity = stringField(body, "quantity", { max: 80, required: true }) as string;
    const unit = stringField(body, "unit", { max: 80, required: true }) as string;
    const productAmount = parseUsdMinorUnits(body.productAmount, "productAmount", 1);
    const shippingAmount = parseUsdMinorUnits(
      body.shippingAmount ?? "0",
      "shippingAmount",
    );
    const paymentDueDate = parsePaymentDueDate(body.paymentDueDate);
    const orderTerms = stringField(body, "orderTerms", { max: 5_000, required: true }) as string;
    const { grossAmount, platformFeeAmount, sellerPayableAmount } = calculatePaymentAmounts(
      productAmount,
      shippingAmount,
    );

    const inquiry = await getDb().inquiry.findFirst({
      where: {
        id: inquiryId,
        sellerCompany: { ownerUserId: user.id, companyRole: "seller" },
      },
      select: {
        id: true,
        buyerCompanyId: true,
        sellerCompanyId: true,
      },
    });
    if (!inquiry) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }

    const paymentRequest = await getDb().$transaction(async (tx) => {
      const created = await tx.paymentRequest.create({
        data: {
          inquiryId: inquiry.id,
          buyerCompanyId: inquiry.buyerCompanyId,
          sellerCompanyId: inquiry.sellerCompanyId,
          createdByUserId: user.id,
          productName,
          quantity,
          unit,
          productAmount,
          shippingAmount,
          grossAmount,
          platformFeeAmount,
          sellerPayableAmount,
          currency: PAYMENT_REQUEST_CURRENCY,
          paymentDueDate,
          orderTerms,
        },
        select: paymentRequestConversationSelect,
      });

      await tx.paymentRequestEvent.create({
        data: {
          paymentRequestId: created.id,
          eventType: PaymentRequestEventType.CREATED,
          actorUserId: user.id,
          message: "Seller created a payment request.",
        },
      });

      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: { updatedAt: new Date() },
      });

      return tx.paymentRequest.findUniqueOrThrow({
        where: { id: created.id },
        select: paymentRequestConversationSelect,
      });
    });

    return Response.json(paymentRequest, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
