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
import { lockSupplierCommerceBoundary } from "@/lib/supplier-commerce-boundary";
import {
  requireSupplierCanAcceptNewOrdersForCompany,
  requireSupplierCanAcceptNewOrdersForCompanyWithDb,
} from "@/lib/supplier-application";
import { isMessagePaymentFeatureEnabledForUser } from "@/lib/message-payment-feature";
import { isTradeOrderSystemEnabledForClerkUser } from "@/lib/trade-order-feature";
import { sendTradeOrderNotification } from "@/lib/trade-order-notifications";
import { createTradeOrderForPaymentRequest } from "@/lib/trade-orders";
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
    if (!isMessagePaymentFeatureEnabledForUser(user.id)) {
      return Response.json(
        { error: "Message payments are not enabled for this account." },
        { status: 403 },
      );
    }
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
        sellerCompany: {
          ownerUserId: user.id,
          companyRole: "seller",
          deletedAt: null,
        },
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
    const shouldCreateTradeOrder = isTradeOrderSystemEnabledForClerkUser(
      user.clerkUserId,
    );
    if (!shouldCreateTradeOrder) {
      return Response.json(
        { error: "Trade orders are not enabled for this account." },
        { status: 409 },
      );
    }
    // Fast-fail before opening a write transaction. The same capability is
    // rechecked after the seller commerce lock below and is the authoritative
    // decision for the insert.
    await requireSupplierCanAcceptNewOrdersForCompany(
      user.id,
      inquiry.sellerCompanyId,
    );

    let tradeOrderId: string | null = null;
    const paymentRequest = await getDb().$transaction(async (tx) => {
      // Lock first, then re-read ownership and supplier eligibility. This
      // prevents a status or brand review from interleaving a lone request.
      await lockSupplierCommerceBoundary(tx, inquiry.sellerCompanyId);
      const lockedInquiry = await tx.inquiry.findFirst({
        where: {
          id: inquiry.id,
          sellerCompanyId: inquiry.sellerCompanyId,
          sellerCompany: {
            ownerUserId: user.id,
            companyRole: "seller",
            deletedAt: null,
          },
        },
        select: {
          id: true,
          buyerCompanyId: true,
          sellerCompanyId: true,
        },
      });
      if (!lockedInquiry) {
        throw new Response("Conversation not found.", { status: 404 });
      }
      await requireSupplierCanAcceptNewOrdersForCompanyWithDb(
        user.id,
        lockedInquiry.sellerCompanyId,
        tx,
      );
      const created = await tx.paymentRequest.create({
        data: {
          inquiryId: lockedInquiry.id,
          buyerCompanyId: lockedInquiry.buyerCompanyId,
          sellerCompanyId: lockedInquiry.sellerCompanyId,
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

      // A payable payment request is always backed by exactly one trade order.
      const order = await createTradeOrderForPaymentRequest(tx, created.id);
      tradeOrderId = order.id;

      await tx.inquiry.update({
        where: { id: lockedInquiry.id },
        data: { updatedAt: new Date() },
      });

      return tx.paymentRequest.findUniqueOrThrow({
        where: { id: created.id },
        select: paymentRequestConversationSelect,
      });
    });

    if (tradeOrderId) {
      try {
        await sendTradeOrderNotification({
          orderId: tradeOrderId,
          kind: "order_created",
          recipient: "both",
          idempotencyKey: `trade82-order-created-${tradeOrderId}`,
        });
      } catch {
        console.error("Trade order notification delivery failed.", { kind: "order_created" });
      }
    }

    return Response.json(paymentRequest, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
