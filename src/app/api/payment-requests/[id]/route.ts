import { PaymentRequestEventType, PaymentRequestStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { syncTradeOrderFromPaymentRequest } from "@/lib/trade-orders";

const cancelFields = new Set(["action"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "message-payment-request-cancel",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const paymentRequestId = idParam(rawId, "paymentRequestId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, cancelFields);
    if (stringField(body, "action", { max: 32, required: true }) !== "cancel") {
      throw validationError("Unsupported payment request action.");
    }

    const db = getDb();
    const paymentRequest = await db.paymentRequest.findFirst({
      where: {
        id: paymentRequestId,
        sellerCompany: {
          ownerUserId: user.id,
          companyRole: "seller",
          deletedAt: null,
        },
      },
      select: {
        id: true,
        inquiryId: true,
        status: true,
        stripeCheckoutSessionId: true,
        checkoutLockExpiresAt: true,
      },
    });
    if (!paymentRequest) {
      return Response.json({ error: "Payment request not found." }, { status: 404 });
    }
    if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
      return Response.json(
        { error: "Only pending payment requests can be cancelled." },
        { status: 409 },
      );
    }
    if (
      paymentRequest.checkoutLockExpiresAt &&
      paymentRequest.checkoutLockExpiresAt.getTime() > Date.now() &&
      !paymentRequest.stripeCheckoutSessionId
    ) {
      return Response.json(
        { error: "Checkout is being prepared. Try cancelling again shortly." },
        { status: 409 },
      );
    }

    if (paymentRequest.stripeCheckoutSessionId) {
      const stripe = getStripe();
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(paymentRequest.stripeCheckoutSessionId);
      } catch (error) {
        console.error("Unable to verify message payment Checkout session before cancellation.", {
          paymentRequestId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return Response.json(
          { error: "Unable to verify the Checkout session. Please try again shortly." },
          { status: 409 },
        );
      }
      if (session.payment_status === "paid" || session.status === "complete") {
        return Response.json(
          { error: "Payment is already completing and cannot be cancelled." },
          { status: 409 },
        );
      }
      if (session.status === "open") {
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (error) {
          console.error("Unable to expire message payment Checkout session before cancellation.", {
            paymentRequestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
          return Response.json(
            { error: "Unable to expire the Checkout session. Please try again shortly." },
            { status: 409 },
          );
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.paymentRequest.updateMany({
        where: { id: paymentRequest.id, status: PaymentRequestStatus.PENDING },
        data: {
          status: PaymentRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          checkoutLockToken: null,
          checkoutLockExpiresAt: null,
        },
      });
      if (updated.count !== 1) return null;
      await tx.paymentRequestEvent.create({
        data: {
          paymentRequestId: paymentRequest.id,
          eventType: PaymentRequestEventType.CANCELLED,
          actorUserId: user.id,
          message: "Seller cancelled the pending payment request.",
        },
      });
      await syncTradeOrderFromPaymentRequest(
        tx,
        {
          id: paymentRequest.id,
          status: PaymentRequestStatus.CANCELLED,
          grossAmount: 0,
          refundAmount: 0,
          paidAt: null,
          stripeProcessingFeeAmount: null,
        },
        "cancelled",
      );
      await tx.inquiry.update({
        where: { id: paymentRequest.inquiryId },
        data: { updatedAt: new Date() },
      });
      return tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } });
    });
    if (!result) {
      return Response.json(
        { error: "Payment status changed while cancellation was in progress. Please refresh." },
        { status: 409 },
      );
    }

    return Response.json(result);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
