import { randomUUID } from "node:crypto";

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
import {
  isPaymentRequestPayable,
  MESSAGE_PAYMENT_REQUEST_FEATURE,
  PAYMENT_REQUEST_CURRENCY,
} from "@/lib/payment-requests";
import {
  claimPaymentRequestCheckout,
  decideCreatedCheckoutSession,
  decideExistingCheckoutSession,
} from "@/lib/payment-request-checkout";
import { checkoutIdempotencyKey } from "@/lib/payment-request-rules";
import { getAppUrl, getStripe } from "@/lib/stripe";

const checkoutFields = new Set(["returnPath"]);
const CHECKOUT_LOCK_MS = 2 * 60_000;

function safeStripeErrorSummary(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const code = typeof record?.code === "string" && /^[A-Za-z0-9_]+$/.test(record.code)
    ? record.code
    : undefined;
  return {
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...(code ? { stripeCode: code } : {}),
  };
}

function messageReturnPath(value: string | null | undefined) {
  return value === "/en/messages" || value === "/ko/messages" || value === "/messages"
    ? value
    : "/messages";
}

function stripeObjectId(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "message-payment-request-checkout",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
      message: "Too many payment attempts. Please wait a moment and try again.",
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const paymentRequestId = idParam(rawId, "paymentRequestId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, checkoutFields);
    const returnPath = messageReturnPath(
      stringField(body, "returnPath", { max: 128, fallback: "/messages" }),
    );

    const db = getDb();
    const paymentRequest = await db.paymentRequest.findFirst({
      where: {
        id: paymentRequestId,
        buyerCompany: { ownerUserId: user.id, companyRole: "buyer" },
      },
    });
    if (!paymentRequest) {
      return Response.json({ error: "Payment request not found." }, { status: 404 });
    }
    if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
      return Response.json(
        { error: "This payment request is no longer available for payment." },
        { status: 409 },
      );
    }
    if (paymentRequest.requiresManualReconciliation) {
      return Response.json(
        { error: "This payment request requires manual reconciliation before payment can continue." },
        { status: 409 },
      );
    }
    if (!isPaymentRequestPayable(paymentRequest)) {
      return Response.json({ error: "This payment request has expired." }, { status: 409 });
    }

    const now = new Date();
    const stripe = getStripe();
    const checkoutLockToken = randomUUID();
    const checkoutLockExpiresAt = new Date(now.getTime() + CHECKOUT_LOCK_MS);
    let claimedCheckout = false;
    if (paymentRequest.stripeCheckoutSessionId) {
      let decision;
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          paymentRequest.stripeCheckoutSessionId,
        );
        decision = decideExistingCheckoutSession({
          outcome: "retrieved",
          session: existingSession,
        });
      } catch (error) {
        console.warn("Unable to retrieve message payment Checkout session.", {
          paymentRequestId,
          ...safeStripeErrorSummary(error),
        });
        decision = decideExistingCheckoutSession({ outcome: "retrieval_failed" });
      }

      if (decision.action === "reuse") {
        return Response.json({ url: decision.url });
      }
      if (decision.action === "processing") {
        return Response.json(
          {
            error: decision.paymentState === "paid"
              ? "Payment was submitted and confirmation is in progress. Please refresh this conversation shortly."
              : "Payment is still processing. Please refresh this conversation shortly.",
          },
          { status: decision.statusCode },
        );
      }
      if (decision.action === "unavailable") {
        return Response.json(
          { error: "Payment checkout is temporarily unavailable. Please try again shortly." },
          { status: decision.statusCode },
        );
      }
      const replacementClaim = await claimPaymentRequestCheckout({
        locker: db,
        paymentRequestId: paymentRequest.id,
        now,
        checkoutLockToken,
        checkoutLockExpiresAt,
        expectedExpiredSessionId: paymentRequest.stripeCheckoutSessionId,
      });
      if (!replacementClaim.claimed) {
        return Response.json(
          { error: "Payment request changed while the expired Checkout session was being handled. Please refresh." },
          { status: 409 },
        );
      }
      claimedCheckout = true;
    }

    if (!claimedCheckout) {
      const claimed = await claimPaymentRequestCheckout({
        locker: db,
        paymentRequestId: paymentRequest.id,
        now,
        checkoutLockToken,
        checkoutLockExpiresAt,
      });
      if (!claimed.claimed) {
        return Response.json(
          { error: "Checkout is already being prepared. Please try again shortly." },
          { status: 409 },
        );
      }
    }

    const claimedRequest = await db.paymentRequest.findFirst({
      where: { id: paymentRequest.id, checkoutLockToken },
    });
    if (!claimedRequest) {
      return Response.json(
        { error: "Checkout could not be prepared. Please try again shortly." },
        { status: 409 },
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1_000);
    const expiresAt = Math.min(
      Math.floor(claimedRequest.paymentDueDate.getTime() / 1_000),
      nowSeconds + 23 * 60 * 60,
    );
    if (expiresAt - nowSeconds < 30 * 60) {
      await db.paymentRequest.updateMany({
        where: { id: claimedRequest.id, checkoutLockToken },
        data: { checkoutLockToken: null, checkoutLockExpiresAt: null },
      });
      throw validationError("This payment request expires too soon to start Checkout.");
    }

    const metadata = {
      feature: MESSAGE_PAYMENT_REQUEST_FEATURE,
      paymentRequestId: claimedRequest.id,
      inquiryId: claimedRequest.inquiryId,
      buyerCompanyId: claimedRequest.buyerCompanyId,
      sellerCompanyId: claimedRequest.sellerCompanyId,
    };
    const appUrl = getAppUrl();
    const successUrl = `${appUrl}${returnPath}?payment_request=${claimedRequest.id}&checkout=complete`;
    const cancelUrl = `${appUrl}${returnPath}?payment_request=${claimedRequest.id}&checkout=cancelled`;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email,
        customer_creation: "always",
        client_reference_id: claimedRequest.id,
        expires_at: expiresAt,
        line_items: [
          {
            price_data: {
              currency: PAYMENT_REQUEST_CURRENCY,
              product_data: {
                name: claimedRequest.productName,
                description: `Trade82 payment request · ${claimedRequest.quantity} ${claimedRequest.unit}`,
              },
              unit_amount: claimedRequest.grossAmount,
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { idempotencyKey: checkoutIdempotencyKey(claimedRequest.id, claimedRequest.checkoutAttempt) },
    );
    const createdDecision = decideCreatedCheckoutSession({
      status: session.status,
      paymentStatus: session.payment_status,
      url: session.url,
    });
    const returnedPaymentIntentId = stripeObjectId(session.payment_intent);

    if (createdDecision.action === "ALLOW_LATER_RETRY") {
      const expired = await db.paymentRequest.updateMany({
        where: {
          id: claimedRequest.id,
          status: PaymentRequestStatus.PENDING,
          checkoutLockToken,
          checkoutAttempt: claimedRequest.checkoutAttempt,
        },
        data: {
          stripeCheckoutSessionId: session.id,
          ...(returnedPaymentIntentId ? { stripePaymentIntentId: returnedPaymentIntentId } : {}),
          checkoutLockToken: null,
          checkoutLockExpiresAt: null,
        },
      });
      return Response.json(
        {
          error: expired.count === 1
            ? "The Checkout session expired. Please start payment again."
            : "Payment request changed while Checkout was being prepared. Please refresh.",
        },
        { status: 409 },
      );
    }

    if (createdDecision.action === "FAIL_CLOSED") {
      const reconciled = await db.$transaction(async (tx) => {
        const update = await tx.paymentRequest.updateMany({
          where: {
            id: claimedRequest.id,
            status: PaymentRequestStatus.PENDING,
            checkoutLockToken,
            checkoutAttempt: claimedRequest.checkoutAttempt,
          },
          data: {
            stripeCheckoutSessionId: session.id,
            ...(returnedPaymentIntentId ? { stripePaymentIntentId: returnedPaymentIntentId } : {}),
            checkoutLockToken: null,
            checkoutLockExpiresAt: null,
            requiresManualReconciliation: true,
            reconciliationNote: "Stripe Checkout returned an unexpected session state.",
          },
        });
        if (update.count !== 1) return false;
        await tx.paymentRequestEvent.create({
          data: {
            paymentRequestId: claimedRequest.id,
            eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
            actorUserId: user.id,
            message: "Stripe Checkout returned an unexpected session state.",
            metadata: { source: "checkout_create", status: session.status ?? "unknown" },
          },
        });
        return true;
      });
      return Response.json(
        {
          error: reconciled
            ? "Payment checkout is temporarily unavailable. Please contact Trade82 support."
            : "Payment request changed while Checkout was being prepared. Please refresh.",
        },
        { status: reconciled ? 503 : 409 },
      );
    }

    const saved = await db.$transaction(async (tx) => {
      const update = await tx.paymentRequest.updateMany({
        where: {
          id: claimedRequest.id,
          status: PaymentRequestStatus.PENDING,
          checkoutLockToken,
          checkoutAttempt: claimedRequest.checkoutAttempt,
        },
        data: {
          stripeCheckoutSessionId: session.id,
          ...(returnedPaymentIntentId ? { stripePaymentIntentId: returnedPaymentIntentId } : {}),
          checkoutLockToken: null,
          checkoutLockExpiresAt: null,
        },
      });
      if (update.count !== 1) return false;
      await tx.paymentRequestEvent.create({
        data: {
          paymentRequestId: claimedRequest.id,
          eventType: PaymentRequestEventType.CHECKOUT_STARTED,
          actorUserId: user.id,
          message: createdDecision.action === "WAIT_FOR_WEBHOOK"
            ? "Recovered Stripe Checkout session is awaiting verified webhook confirmation."
            : "Buyer opened Stripe Checkout.",
          metadata: {
            checkoutAttempt: claimedRequest.checkoutAttempt,
            sessionStatus: session.status,
            ...(createdDecision.action === "WAIT_FOR_WEBHOOK"
              ? { paymentStatus: createdDecision.paymentState }
              : {}),
          },
        },
      });
      await tx.inquiry.update({
        where: { id: claimedRequest.inquiryId },
        data: { updatedAt: new Date() },
      });
      return true;
    });

    if (!saved) {
      if (createdDecision.action === "RETURN_OPEN_SESSION") {
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (error) {
          console.warn("Unable to expire an unlinked message payment Checkout session.", {
            paymentRequestId: claimedRequest.id,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }
      return Response.json(
        { error: "Payment request changed while Checkout was being prepared. Please refresh." },
        { status: 409 },
      );
    }

    if (createdDecision.action === "WAIT_FOR_WEBHOOK") {
      return Response.json(
        {
          status: "processing",
          message: "Payment confirmation is being processed.",
        },
        { status: 202 },
      );
    }

    return Response.json({ url: createdDecision.url });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
