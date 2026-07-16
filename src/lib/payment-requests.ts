import "server-only";

import Stripe from "stripe";

import {
  PaymentRequestEventType,
  PaymentRequestStatus,
  Prisma,
  StripeFeeSyncStatus,
  type PaymentRequest,
} from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { getDb } from "@/lib/db";
import {
  calculatePaymentAmounts as calculateStrictPaymentAmounts,
  cappedCumulativeRefundAmount,
  chargeMatchesPaymentIntent,
  decidePaymentIntentCheckoutSession,
  isPaymentRequestPayableState,
  parseUsdMinorUnits as parseStrictUsdMinorUnits,
  paymentIntentMetadataMismatchReasons,
  PaymentRequestValidationError,
  storedCheckoutSessionMismatchReasons,
  statusAfterClosedDispute,
  statusAfterRefund,
} from "@/lib/payment-request-rules";
import { getStripe } from "@/lib/stripe";
import {
  claimPaymentRequestWebhookEvent,
  claimPendingPaymentRequestPaid,
} from "@/lib/payment-request-webhook";
import {
  reconcileSettlementAfterVerifiedDispute,
  reconcileSettlementAfterVerifiedRefund,
} from "@/lib/stripe-connect-settlement-reconciliation";
import { syncTradeOrderFromPaymentRequest } from "@/lib/trade-orders";
import { sendTradeOrderNotification } from "@/lib/trade-order-notifications";

export {
  MAX_PAYMENT_AMOUNT_MINOR,
  PAYMENT_REQUEST_CURRENCY,
  PLATFORM_FEE_BASIS_POINTS,
} from "@/lib/payment-request-rules";

export const MESSAGE_PAYMENT_REQUEST_FEATURE = "message_payment_request";

export const paymentRequestConversationSelect = {
  id: true,
  productName: true,
  quantity: true,
  unit: true,
  productAmount: true,
  shippingAmount: true,
  grossAmount: true,
  platformFeeAmount: true,
  sellerPayableAmount: true,
  stripeProcessingFeeAmount: true,
  stripeFeeSyncStatus: true,
  refundAmount: true,
  currency: true,
  paymentDueDate: true,
  orderTerms: true,
  status: true,
  paidAt: true,
  cancelledAt: true,
  releasedAt: true,
  createdAt: true,
  updatedAt: true,
  disputes: {
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: {
      status: true,
      reason: true,
      updatedAt: true,
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      eventType: true,
      message: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PaymentRequestSelect;

export function parseUsdMinorUnits(value: unknown, field: string, minimum = 0) {
  try {
    return parseStrictUsdMinorUnits(value, field, minimum);
  } catch (error) {
    if (error instanceof PaymentRequestValidationError) {
      throw validationError(error.message);
    }
    throw error;
  }
}

export function calculatePaymentAmounts(productAmount: number, shippingAmount: number) {
  try {
    return calculateStrictPaymentAmounts(productAmount, shippingAmount);
  } catch (error) {
    if (error instanceof PaymentRequestValidationError) {
      throw validationError(error.message);
    }
    throw error;
  }
}

export function parsePaymentDueDate(value: unknown) {
  if (typeof value !== "string") {
    throw validationError("paymentDueDate is required.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw validationError("paymentDueDate must use YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dueDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (
    dueDate.getUTCFullYear() !== year ||
    dueDate.getUTCMonth() !== month - 1 ||
    dueDate.getUTCDate() !== day
  ) {
    throw validationError("paymentDueDate is invalid.");
  }
  if (dueDate.getTime() <= Date.now()) {
    throw validationError("paymentDueDate must be in the future.");
  }
  if (dueDate.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1_000) {
    throw validationError("paymentDueDate must be within one year.");
  }

  return dueDate;
}

export function isPaymentRequestPayable(
  paymentRequest: Pick<PaymentRequest, "status" | "paymentDueDate">,
) {
  return (
    isPaymentRequestPayableState(paymentRequest.status, paymentRequest.paymentDueDate)
  );
}

export function idOf(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : null;
}

function paymentRequestIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (metadata?.feature !== MESSAGE_PAYMENT_REQUEST_FEATURE) return null;
  const paymentRequestId = metadata.paymentRequestId;
  return paymentRequestId && /^[A-Za-z0-9_-]{1,128}$/.test(paymentRequestId)
    ? paymentRequestId
    : null;
}

type StripeEventContext = {
  stripeEventId: string;
  stripeEventType: string;
  stripeEventCreatedAt: Date;
};

async function appendEvent(
  tx: Prisma.TransactionClient,
  {
    paymentRequestId,
    eventType,
    actorUserId,
    stripeEventId,
    message,
    metadata,
  }: {
    paymentRequestId: string;
    eventType: PaymentRequestEventType;
    actorUserId?: string | null;
    stripeEventId?: string | null;
    message?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.paymentRequestEvent.create({
    data: {
      paymentRequestId,
      eventType,
      ...(actorUserId ? { actorUserId } : {}),
      ...(stripeEventId ? { stripeEventId } : {}),
      ...(message ? { message } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
}

async function findPaymentRequestForStripeObject({
  paymentRequestId,
  paymentIntentId,
}: {
  paymentRequestId: string | null;
  paymentIntentId: string | null;
}) {
  if (paymentRequestId) {
    const request = await getDb().paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });
    if (request) return request;
  }

  if (paymentIntentId) {
    return getDb().paymentRequest.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }

  return null;
}

async function findPaymentRequestFromPaymentIntent(paymentIntentId: string) {
  const direct = await getDb().paymentRequest.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (direct) return direct;

  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  return findPaymentRequestForStripeObject({
    paymentRequestId: paymentRequestIdFromMetadata(intent.metadata),
    paymentIntentId,
  });
}

async function loadPaymentRequestForUpdate(
  tx: Prisma.TransactionClient,
  paymentRequestId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "PaymentRequest" WHERE "id" = ${paymentRequestId} FOR UPDATE`,
  );
  if (rows.length === 0) throw new Error("Payment request was not found.");
  return tx.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequestId } });
}

type StripePaymentDetails = {
  paymentIntentMetadata: Stripe.Metadata;
  amount: number;
  currency: string;
  chargeId: string | null;
  stripeProcessingFeeAmount: number | null;
};

type StoredCheckoutSessionDetails = {
  id: string;
  paymentIntentId: string | null;
  metadata: Stripe.Metadata | null;
  amountTotal: number | null;
  currency: string | null;
};

type StripeFeeRefreshResult =
  | { ok: true; details: StripePaymentDetails }
  | { ok: false; error: string };

async function stripePaymentDetails(paymentIntentId: string): Promise<StripePaymentDetails> {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  if (intent.id !== paymentIntentId) {
    throw new Error("Stripe returned an unexpected payment intent.");
  }

  const expandedCharge = intent.latest_charge;
  const charge =
    typeof expandedCharge === "string"
      ? await stripe.charges.retrieve(expandedCharge, { expand: ["balance_transaction"] })
      : expandedCharge;
  if (!charge) {
    return {
      paymentIntentMetadata: intent.metadata,
      amount: intent.amount_received || intent.amount,
      currency: intent.currency,
      chargeId: null,
      stripeProcessingFeeAmount: null,
    };
  }
  if (!chargeMatchesPaymentIntent(idOf(charge.payment_intent), paymentIntentId)) {
    throw new Error("Stripe charge did not match the payment intent.");
  }

  const balanceTransaction = charge.balance_transaction;
  const balance =
    typeof balanceTransaction === "string"
      ? await stripe.balanceTransactions.retrieve(balanceTransaction)
      : balanceTransaction;

  return {
    paymentIntentMetadata: intent.metadata,
    amount: intent.amount_received || intent.amount,
    currency: intent.currency,
    chargeId: charge.id,
    stripeProcessingFeeAmount: balance?.fee ?? null,
  };
}

async function storedCheckoutSessionDetails(
  checkoutSessionId: string,
): Promise<StoredCheckoutSessionDetails> {
  const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
  if (session.id !== checkoutSessionId) {
    throw new Error("Stripe returned an unexpected Checkout session.");
  }
  return {
    id: session.id,
    paymentIntentId: idOf(session.payment_intent),
    metadata: session.metadata,
    amountTotal: session.amount_total,
    currency: session.currency,
  };
}

function paymentIntegrityMismatches({
  request,
  inquiry,
  checkoutSessionId,
  paymentIntentId,
  grossAmount,
  currency,
  metadata,
}: {
  request: PaymentRequest;
  inquiry: { buyerCompanyId: string; sellerCompanyId: string } | null;
  checkoutSessionId?: string | null;
  paymentIntentId: string | null;
  grossAmount: number | null;
  currency: string | null;
  metadata?: Stripe.Metadata | null;
}) {
  const mismatches: string[] = [];
  if (grossAmount === null || grossAmount !== request.grossAmount) mismatches.push("amount");
  if (currency !== "usd" || request.currency !== "usd") {
    mismatches.push("currency");
  }
  if (checkoutSessionId && request.stripeCheckoutSessionId && request.stripeCheckoutSessionId !== checkoutSessionId) {
    mismatches.push("checkout_session");
  }
  if (paymentIntentId && request.stripePaymentIntentId && request.stripePaymentIntentId !== paymentIntentId) {
    mismatches.push("payment_intent");
  }
  if (!inquiry || inquiry.buyerCompanyId !== request.buyerCompanyId || inquiry.sellerCompanyId !== request.sellerCompanyId) {
    mismatches.push("conversation_parties");
  }
  if (metadata?.inquiryId && metadata.inquiryId !== request.inquiryId) mismatches.push("metadata_inquiry");
  if (metadata?.buyerCompanyId && metadata.buyerCompanyId !== request.buyerCompanyId) {
    mismatches.push("metadata_buyer");
  }
  if (metadata?.sellerCompanyId && metadata.sellerCompanyId !== request.sellerCompanyId) {
    mismatches.push("metadata_seller");
  }
  return mismatches;
}

async function markReconciliationRequired(
  tx: Prisma.TransactionClient,
  {
    paymentRequestId,
    message,
    metadata,
    stripeEventId,
  }: {
    paymentRequestId: string;
    message: string;
    metadata: Prisma.InputJsonValue;
    stripeEventId?: string | null;
  },
) {
  await tx.paymentRequest.update({
    where: { id: paymentRequestId },
    data: {
      requiresManualReconciliation: true,
      reconciliationNote: message,
    },
  });
  await appendEvent(tx, {
    paymentRequestId,
    eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
    stripeEventId,
    message,
    metadata,
  });
}

async function markPaymentConfirmationReconciliation(
  tx: Prisma.TransactionClient,
  {
    request,
    checkoutSessionId,
    paymentIntentId,
    chargeId,
    stripeEvent,
    reasons,
  }: {
    request: Pick<
      PaymentRequest,
      | "id"
      | "stripeCheckoutSessionId"
      | "stripePaymentIntentId"
      | "stripeChargeId"
    >;
    checkoutSessionId?: string | null;
    paymentIntentId: string | null;
    chargeId?: string | null;
    stripeEvent: StripeEventContext;
    reasons: string[];
  },
) {
  const message = "Stripe payment confirmation requires manual reconciliation.";
  await tx.paymentRequest.update({
    where: { id: request.id },
    data: {
      ...(checkoutSessionId && !request.stripeCheckoutSessionId
        ? { stripeCheckoutSessionId: checkoutSessionId }
        : {}),
      ...(paymentIntentId && !request.stripePaymentIntentId
        ? { stripePaymentIntentId: paymentIntentId }
        : {}),
      ...(chargeId && !request.stripeChargeId ? { stripeChargeId: chargeId } : {}),
      requiresManualReconciliation: true,
      reconciliationNote: message,
    },
  });
  await appendEvent(tx, {
    paymentRequestId: request.id,
    eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
    stripeEventId: stripeEvent.stripeEventId,
    message,
    metadata: {
      source: stripeEvent.stripeEventType,
      reasons,
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
      ...(paymentIntentId ? { paymentIntentId } : {}),
      ...(chargeId ? { chargeId } : {}),
    },
  });
}

export async function refreshStripeProcessingFeeForPaymentRequest(
  paymentRequestId: string,
): Promise<StripeFeeRefreshResult> {
  const paymentRequest = await getDb().paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: {
      id: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
    },
  });
  if (!paymentRequest) return { ok: false, error: "Payment request not found." };
  if (!paymentRequest.stripePaymentIntentId) {
    await getDb().paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
        stripeFeeSyncError: "Stripe payment intent is not available yet.",
        stripeFeeSyncedAt: new Date(),
      },
    });
    return { ok: false, error: "Stripe payment intent is not available yet." };
  }

  try {
    const details = await stripePaymentDetails(paymentRequest.stripePaymentIntentId);
    if (!details.chargeId || details.stripeProcessingFeeAmount === null) {
      await getDb().paymentRequest.update({
        where: { id: paymentRequest.id },
        data: {
          stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
          stripeFeeSyncError: "Stripe processing fee is not available yet. Retry from the admin payment record.",
          stripeFeeSyncedAt: new Date(),
        },
      });
      return { ok: false, error: "Stripe processing fee is not available yet." };
    }
    if (
      paymentRequest.stripeChargeId &&
      details.chargeId &&
      paymentRequest.stripeChargeId !== details.chargeId
    ) {
      await getDb().$transaction(async (tx) => {
        await markReconciliationRequired(tx, {
          paymentRequestId: paymentRequest.id,
          message: "Stripe charge mismatch requires manual reconciliation.",
          metadata: { source: "stripe_fee_refresh", reason: "charge_mismatch" },
        });
        await tx.paymentRequest.update({
          where: { id: paymentRequest.id },
          data: {
            stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
            stripeFeeSyncError: "Stripe charge mismatch requires reconciliation.",
            stripeFeeSyncedAt: new Date(),
          },
        });
      });
      return { ok: false, error: "Stripe charge mismatch requires reconciliation." };
    }

    await getDb().paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        ...(details.chargeId ? { stripeChargeId: details.chargeId } : {}),
        ...(details.stripeProcessingFeeAmount !== null
          ? { stripeProcessingFeeAmount: details.stripeProcessingFeeAmount }
          : {}),
        stripeFeeSyncStatus: StripeFeeSyncStatus.SYNCED,
        stripeFeeSyncError: null,
        stripeFeeSyncedAt: new Date(),
      },
    });
    return { ok: true, details };
  } catch (error) {
    console.error("Stripe processing fee synchronization failed.", {
      paymentRequestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    await getDb().paymentRequest.update({
      where: { id: paymentRequest.id },
      data: {
        stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
        stripeFeeSyncError: "Stripe processing fee sync failed. Retry from the admin payment record.",
        stripeFeeSyncedAt: new Date(),
      },
    });
    return { ok: false, error: "Stripe processing fee sync failed." };
  }
}

export async function markPaymentRequestPaid({
  paymentRequestId,
  checkoutSessionId,
  paymentIntentId,
  grossAmount,
  currency,
  metadata,
  stripeEvent,
  confirmationSource,
}: {
  paymentRequestId: string;
  checkoutSessionId?: string | null;
  paymentIntentId: string | null;
  grossAmount: number | null;
  currency: string | null;
  metadata?: Stripe.Metadata | null;
  stripeEvent: StripeEventContext;
  confirmationSource: "checkout_session" | "payment_intent";
}) {
  const existing = await getDb().paymentRequest.findUnique({
    where: { id: paymentRequestId },
    include: { inquiry: { select: { buyerCompanyId: true, sellerCompanyId: true } } },
  });
  if (!existing) return false;

  // payment_intent.succeeded can be delivered before checkout.session.completed.
  // Without a persisted session, leave the request pending for the Checkout event.
  const initialPaymentIntentCheckoutDecision =
    confirmationSource === "payment_intent"
      ? decidePaymentIntentCheckoutSession(existing.stripeCheckoutSessionId)
      : null;
  if (initialPaymentIntentCheckoutDecision?.action === "WAIT_FOR_CHECKOUT_SESSION") {
    await getDb().$transaction(async (tx) => {
      await claimPaymentRequestWebhookEvent({
        locker: tx,
        paymentRequestId,
        ...stripeEvent,
      });
    });
    return true;
  }

  let paymentDetails: StripePaymentDetails | null = null;
  let paymentDetailsError: string | null = null;
  if (paymentIntentId) {
    try {
      paymentDetails = await stripePaymentDetails(paymentIntentId);
    } catch (error) {
      console.error("Stripe payment confirmation lookup failed.", {
        paymentRequestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      paymentDetailsError = "Stripe payment details could not be verified.";
    }
  } else {
    paymentDetailsError = "Stripe payment intent is missing.";
  }

  let storedCheckoutSession: StoredCheckoutSessionDetails | null = null;
  let storedCheckoutSessionError: string | null = null;
  if (confirmationSource === "payment_intent" && existing.stripeCheckoutSessionId) {
    try {
      storedCheckoutSession = await storedCheckoutSessionDetails(
        existing.stripeCheckoutSessionId,
      );
    } catch (error) {
      console.error("Stored Stripe Checkout session lookup failed during payment confirmation.", {
        paymentRequestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      storedCheckoutSessionError = "stored_checkout_session_unavailable";
    }
  }
  const paymentIntentCheckoutDecision =
    confirmationSource === "payment_intent"
      ? decidePaymentIntentCheckoutSession(
          existing.stripeCheckoutSessionId,
          Boolean(storedCheckoutSessionError),
        )
      : null;

  const feeResult:
    | { ok: true; details: StripePaymentDetails }
    | { ok: false; error: string }
    | null = paymentDetails
    ? paymentDetails.chargeId && paymentDetails.stripeProcessingFeeAmount !== null
      ? { ok: true, details: paymentDetails }
      : {
          ok: false,
          error: "Stripe processing fee is not available yet. Retry from the admin payment record.",
        }
    : null;

  let paymentConfirmedOrderId: string | null = null;
  await getDb().$transaction(async (tx) => {
    if (!(await claimPaymentRequestWebhookEvent({
      locker: tx,
      paymentRequestId,
      ...stripeEvent,
    }))) return;

    const current = await tx.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: { inquiry: { select: { buyerCompanyId: true, sellerCompanyId: true } } },
    });
    if (!current) return;
    if (
      current.status === PaymentRequestStatus.PENDING &&
      current.requiresManualReconciliation
    ) {
      return;
    }

    const checkoutSessionIdForValidation =
      confirmationSource === "payment_intent"
        ? storedCheckoutSession?.id ?? null
        : checkoutSessionId;

    const currentMismatches = paymentIntegrityMismatches({
      request: current,
      inquiry: current.inquiry,
      checkoutSessionId: checkoutSessionIdForValidation,
      paymentIntentId,
      grossAmount,
      currency,
      metadata,
    });
    const paymentIntentMetadataMismatches = paymentIntentMetadataMismatchReasons(
      {
        paymentRequestId: current.id,
        inquiryId: current.inquiryId,
        buyerCompanyId: current.buyerCompanyId,
        sellerCompanyId: current.sellerCompanyId,
      },
      paymentDetails?.paymentIntentMetadata,
    );
    const storedCheckoutSessionMismatches =
      confirmationSource === "payment_intent"
        ? [
            ...(current.stripeCheckoutSessionId === existing.stripeCheckoutSessionId
              ? []
              : ["stored_checkout_session_changed"]),
            ...(paymentIntentCheckoutDecision?.action === "RECONCILE_STORED_CHECKOUT_SESSION"
              ? [storedCheckoutSessionError ?? "stored_checkout_session_unavailable"]
              : []),
            ...(storedCheckoutSession
              ? storedCheckoutSessionMismatchReasons(
                  {
                    checkoutSessionId: current.stripeCheckoutSessionId ?? "",
                    paymentIntentId: paymentIntentId ?? "",
                    paymentRequestId: current.id,
                    inquiryId: current.inquiryId,
                    buyerCompanyId: current.buyerCompanyId,
                    sellerCompanyId: current.sellerCompanyId,
                  },
                  storedCheckoutSession,
                )
              : []),
            ...(storedCheckoutSession && storedCheckoutSession.amountTotal !== current.grossAmount
              ? ["stored_checkout_amount"]
              : []),
            ...(storedCheckoutSession && storedCheckoutSession.currency !== "usd"
              ? ["stored_checkout_currency"]
              : []),
          ]
        : [];
    const confirmationMismatches = Array.from(
      new Set([
        ...currentMismatches,
        ...paymentIntentMetadataMismatches,
        ...storedCheckoutSessionMismatches,
        ...(paymentDetails && paymentDetails.amount !== current.grossAmount
          ? ["payment_intent_amount"]
          : []),
        ...(paymentDetails && paymentDetails.currency !== "usd"
          ? ["payment_intent_currency"]
          : []),
        ...(paymentDetails ? (paymentDetails.chargeId ? [] : ["missing_charge"]) : [
          paymentDetailsError ?? "payment_intent_unavailable",
        ]),
      ]),
    );
    if (confirmationMismatches.length > 0 || !paymentIntentId) {
      await markPaymentConfirmationReconciliation(tx, {
        request: current,
        checkoutSessionId: checkoutSessionIdForValidation ?? current.stripeCheckoutSessionId,
        paymentIntentId,
        chargeId: paymentDetails?.chargeId,
        stripeEvent,
        reasons: confirmationMismatches,
      });
      return;
    }

    const updateData: Prisma.PaymentRequestUpdateManyMutationInput = {
      ...(checkoutSessionIdForValidation
        ? { stripeCheckoutSessionId: checkoutSessionIdForValidation }
        : {}),
      stripePaymentIntentId: paymentIntentId,
      checkoutLockToken: null,
      checkoutLockExpiresAt: null,
      ...(feeResult?.ok
        ? {
            ...(feeResult.details.chargeId ? { stripeChargeId: feeResult.details.chargeId } : {}),
            ...(feeResult.details.stripeProcessingFeeAmount !== null
              ? { stripeProcessingFeeAmount: feeResult.details.stripeProcessingFeeAmount }
              : {}),
            stripeFeeSyncStatus: StripeFeeSyncStatus.SYNCED,
            stripeFeeSyncError: null,
            stripeFeeSyncedAt: new Date(),
          }
        : feeResult
          ? {
              stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
              stripeFeeSyncError: feeResult.error,
              stripeFeeSyncedAt: new Date(),
            }
          : {}),
      status: PaymentRequestStatus.PAID,
      paidAt: current.paidAt ?? new Date(),
    };
    const paid = await claimPendingPaymentRequestPaid({
      locker: tx,
      paymentRequestId: current.id,
      data: updateData,
    });
    if (paid) {
      await appendEvent(tx, {
        paymentRequestId: current.id,
        eventType: PaymentRequestEventType.PAID,
        stripeEventId: stripeEvent.stripeEventId,
        message: "Payment confirmed by Stripe.",
        metadata: { source: stripeEvent.stripeEventType },
      });
      paymentConfirmedOrderId = await syncTradeOrderFromPaymentRequest(
        tx,
        {
          id: current.id,
          status: PaymentRequestStatus.PAID,
          grossAmount: current.grossAmount,
          refundAmount: current.refundAmount,
          paidAt: current.paidAt ?? new Date(),
          stripeProcessingFeeAmount: feeResult?.ok
            ? feeResult.details.stripeProcessingFeeAmount
            : current.stripeProcessingFeeAmount,
        },
        "paid",
      );
      await tx.inquiry.update({ where: { id: current.inquiryId }, data: { updatedAt: new Date() } });
      return;
    }

    const latest = await tx.paymentRequest.findUniqueOrThrow({ where: { id: current.id } });
    if (latest.status === PaymentRequestStatus.PAID || latest.status === PaymentRequestStatus.RELEASED) {
      await tx.paymentRequest.update({
        where: { id: latest.id },
        data: {
          ...(checkoutSessionId && !latest.stripeCheckoutSessionId
            ? { stripeCheckoutSessionId: checkoutSessionId }
            : {}),
          ...(paymentIntentId && !latest.stripePaymentIntentId
            ? { stripePaymentIntentId: paymentIntentId }
            : {}),
          ...(feeResult?.ok
            ? {
                ...(feeResult.details.chargeId && !latest.stripeChargeId
                  ? { stripeChargeId: feeResult.details.chargeId }
                  : {}),
                ...(feeResult.details.stripeProcessingFeeAmount !== null &&
                latest.stripeProcessingFeeAmount === null
                  ? { stripeProcessingFeeAmount: feeResult.details.stripeProcessingFeeAmount }
                  : {}),
                stripeFeeSyncStatus: StripeFeeSyncStatus.SYNCED,
                stripeFeeSyncError: null,
                stripeFeeSyncedAt: new Date(),
              }
            : feeResult
              ? {
                  stripeFeeSyncStatus: StripeFeeSyncStatus.FAILED,
                  stripeFeeSyncError: feeResult.error,
                  stripeFeeSyncedAt: new Date(),
                }
              : {}),
        },
      });
      return;
    }
    await markReconciliationRequired(tx, {
      paymentRequestId: latest.id,
      message: "Stripe payment confirmation arrived after the request changed state.",
      metadata: { source: stripeEvent.stripeEventType, status: latest.status },
    });
  });

  if (paymentConfirmedOrderId) {
    try {
      await sendTradeOrderNotification({
        orderId: paymentConfirmedOrderId,
        kind: "payment_received",
        recipient: "seller",
        idempotencyKey: `trade82-order-payment-${stripeEvent.stripeEventId}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: "payment_received" });
    }
  }
  return true;
}

export async function markPaymentRequestPaidFromCheckoutSession(
  session: Stripe.Checkout.Session,
  stripeEvent: StripeEventContext,
) {
  const paymentRequestId = paymentRequestIdFromMetadata(session.metadata);
  if (!paymentRequestId || session.payment_status !== "paid") return false;

  return markPaymentRequestPaid({
    paymentRequestId,
    checkoutSessionId: session.id,
    paymentIntentId: idOf(session.payment_intent),
    grossAmount: session.amount_total,
    currency: session.currency,
    metadata: session.metadata,
    stripeEvent,
    confirmationSource: "checkout_session",
  });
}

export async function markPaymentRequestPaidFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  stripeEvent: StripeEventContext,
) {
  const paymentRequestId = paymentRequestIdFromMetadata(paymentIntent.metadata);
  if (!paymentRequestId || paymentIntent.status !== "succeeded") return false;

  return markPaymentRequestPaid({
    paymentRequestId,
    paymentIntentId: paymentIntent.id,
    grossAmount: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: paymentIntent.metadata,
    stripeEvent,
    confirmationSource: "payment_intent",
  });
}

export async function syncPaymentRequestRefund(
  refund: Stripe.Refund,
  stripeEvent: StripeEventContext,
) {
  assertStripeEventTimestamp(stripeEvent);
  const paymentIntentId = idOf(refund.payment_intent);
  if (!paymentIntentId) return false;

  const paymentRequest = await findPaymentRequestFromPaymentIntent(paymentIntentId);
  if (!paymentRequest) return false;

  let payoutHoldOrderId: string | null = null;
  let payoutHoldRequired = false;
  await getDb().$transaction(async (tx) => {
    // Lock the request before claiming the event. Claiming first inserts a row
    // with a foreign key to this request, which can deadlock concurrent refunds
    // against the request's FOR UPDATE lock.
    const current = await loadPaymentRequestForUpdate(tx, paymentRequest.id);
    if (!(await claimPaymentRequestWebhookEvent({
      locker: tx,
      paymentRequestId: paymentRequest.id,
      ...stripeEvent,
    }))) return;

    if (current.stripePaymentIntentId && current.stripePaymentIntentId !== paymentIntentId) {
      await markReconciliationRequired(tx, {
        paymentRequestId: current.id,
        stripeEventId: stripeEvent.stripeEventId,
        message: "Stripe refund payment intent mismatch requires manual reconciliation.",
        metadata: { source: stripeEvent.stripeEventType, reason: "payment_intent_mismatch" },
      });
      return;
    }

    await tx.paymentRefund.upsert({
      where: { stripeRefundId: refund.id },
      create: {
        paymentRequestId: current.id,
        stripeRefundId: refund.id,
        amount: refund.amount,
        status: refund.status ?? "unknown",
      },
      update: { amount: refund.amount, status: refund.status ?? "unknown" },
    });
    if (refund.status !== "succeeded") return;

    const total = await tx.paymentRefund.aggregate({
      where: { paymentRequestId: current.id, status: "succeeded" },
      _sum: { amount: true },
    });
    const refundAmount = cappedCumulativeRefundAmount(total._sum.amount ?? 0, current.grossAmount);
    const status = statusAfterRefund(refundAmount, current.grossAmount) as PaymentRequestStatus;
    await tx.paymentRequest.update({ where: { id: current.id }, data: { refundAmount, status } });
    await appendEvent(tx, {
      paymentRequestId: current.id,
      eventType:
        status === PaymentRequestStatus.REFUNDED
          ? PaymentRequestEventType.REFUNDED
          : PaymentRequestEventType.PARTIALLY_REFUNDED,
      stripeEventId: stripeEvent.stripeEventId,
      message: "Refund confirmed by Stripe.",
      metadata: { source: stripeEvent.stripeEventType },
    });
    payoutHoldOrderId = await syncTradeOrderFromPaymentRequest(
      tx,
      {
        id: current.id,
        status,
        grossAmount: current.grossAmount,
        refundAmount,
        paidAt: current.paidAt,
        stripeProcessingFeeAmount: current.stripeProcessingFeeAmount,
      },
      "refund",
    );
    payoutHoldRequired = status === PaymentRequestStatus.PARTIALLY_REFUNDED;
    if (current.releasedAt) {
      await markReconciliationRequired(tx, {
        paymentRequestId: current.id,
        message: "A refund was received after manual seller payout and requires reconciliation.",
        metadata: { source: stripeEvent.stripeEventType, reason: "refund_after_release" },
      });
    }
    await reconcileSettlementAfterVerifiedRefund(tx, {
      paymentRequestId: current.id,
      stripeSourceId: refund.id,
      stripeEventId: stripeEvent.stripeEventId,
      stripeEventType: stripeEvent.stripeEventType,
      stripeEventCreatedAt: stripeEvent.stripeEventCreatedAt,
    });
  });
  if (payoutHoldOrderId && payoutHoldRequired) {
    try {
      await sendTradeOrderNotification({
        orderId: payoutHoldOrderId,
        kind: "payout_on_hold",
        recipient: "seller",
        idempotencyKey: `trade82-payout-hold-refund-${stripeEvent.stripeEventId}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: "payout_on_hold" });
    }
  }
  return true;
}

function disputeIsClosed(status: string) {
  return ["won", "lost", "prevented", "warning_closed", "charge_refunded"].includes(status);
}

function disputeStatusRank(status: string) {
  if (status === "lost" || status === "charge_refunded") return 3;
  if (disputeIsClosed(status)) return 2;
  return 1;
}

function shouldApplyDisputeStripeEvent(
  existing: {
    status: string;
    lastStripeEventCreatedAt: Date;
    lastStripeEventId: string;
  },
  incoming: StripeEventContext & { disputeStatus: string },
) {
  const existingTime = existing.lastStripeEventCreatedAt.getTime();
  const incomingTime = incoming.stripeEventCreatedAt.getTime();
  if (incomingTime !== existingTime) return incomingTime > existingTime;

  const incomingRank = disputeStatusRank(incoming.disputeStatus);
  const existingRank = disputeStatusRank(existing.status);
  if (incomingRank !== existingRank) return incomingRank > existingRank;

  return incoming.stripeEventId.localeCompare(existing.lastStripeEventId) > 0;
}

function assertStripeEventTimestamp(stripeEvent: StripeEventContext) {
  if (Number.isNaN(stripeEvent.stripeEventCreatedAt.getTime())) {
    throw new Error("Stripe webhook event timestamp is invalid.");
  }
}

export async function syncPaymentRequestDispute(
  dispute: Stripe.Dispute,
  stripeEvent: StripeEventContext,
) {
  assertStripeEventTimestamp(stripeEvent);
  const paymentIntentId = idOf(dispute.payment_intent);
  if (!paymentIntentId) return false;

  const paymentRequest = await findPaymentRequestFromPaymentIntent(paymentIntentId);
  if (!paymentRequest) return false;
  const disputeStatus = dispute.status as string;

  let payoutHoldOrderId: string | null = null;
  let payoutHoldRequired = false;
  await getDb().$transaction(async (tx) => {
    // See refund synchronization above: keep the row-lock/foreign-key lock
    // order stable across concurrent webhook deliveries.
    const current = await loadPaymentRequestForUpdate(tx, paymentRequest.id);
    if (!(await claimPaymentRequestWebhookEvent({
      locker: tx,
      paymentRequestId: paymentRequest.id,
      ...stripeEvent,
    }))) return;

    if (current.stripePaymentIntentId && current.stripePaymentIntentId !== paymentIntentId) {
      await markReconciliationRequired(tx, {
        paymentRequestId: current.id,
        stripeEventId: stripeEvent.stripeEventId,
        message: "Stripe dispute payment intent mismatch requires manual reconciliation.",
        metadata: { source: stripeEvent.stripeEventType, reason: "payment_intent_mismatch" },
      });
      return;
    }

    const existingDispute = await tx.paymentDispute.findUnique({
      where: { stripeDisputeId: dispute.id },
      select: {
        paymentRequestId: true,
        status: true,
        lastStripeEventCreatedAt: true,
        lastStripeEventId: true,
      },
    });
    if (existingDispute && existingDispute.paymentRequestId !== current.id) {
      await markReconciliationRequired(tx, {
        paymentRequestId: current.id,
        stripeEventId: stripeEvent.stripeEventId,
        message: "Stripe dispute is already associated with another payment request.",
        metadata: { source: stripeEvent.stripeEventType, reason: "dispute_payment_request_mismatch" },
      });
      return;
    }
    if (
      existingDispute
      && !shouldApplyDisputeStripeEvent(existingDispute, { ...stripeEvent, disputeStatus })
    ) {
      return;
    }

    const persistedDispute = existingDispute
      ? await tx.paymentDispute.update({
        where: { stripeDisputeId: dispute.id },
        data: {
          amount: dispute.amount,
          status: disputeStatus,
          reason: dispute.reason ?? null,
          lastStripeEventCreatedAt: stripeEvent.stripeEventCreatedAt,
          lastStripeEventId: stripeEvent.stripeEventId,
        },
      })
      : await tx.paymentDispute.create({
        data: {
          paymentRequestId: current.id,
          stripeDisputeId: dispute.id,
          amount: dispute.amount,
          status: disputeStatus,
          reason: dispute.reason ?? null,
          lastStripeEventCreatedAt: stripeEvent.stripeEventCreatedAt,
          lastStripeEventId: stripeEvent.stripeEventId,
        },
      });

    const anotherOpenDispute = await tx.paymentDispute.findFirst({
      where: {
        paymentRequestId: current.id,
        stripeDisputeId: { not: persistedDispute.stripeDisputeId },
        status: { notIn: ["won", "lost", "prevented", "warning_closed", "charge_refunded"] },
      },
      select: { id: true },
    });

    let nextStatus: PaymentRequestStatus;
    let refundAmount = current.refundAmount;
    if (disputeStatus === "lost" || disputeStatus === "charge_refunded") {
      refundAmount = Math.min(Math.max(current.refundAmount, dispute.amount), current.grossAmount);
      nextStatus =
        refundAmount >= current.grossAmount
          ? PaymentRequestStatus.REFUNDED
          : PaymentRequestStatus.PARTIALLY_REFUNDED;
    } else if (disputeIsClosed(disputeStatus) && !anotherOpenDispute) {
      nextStatus = statusAfterClosedDispute({
        releasedAt: current.releasedAt,
        refundAmount: current.refundAmount,
        grossAmount: current.grossAmount,
      }) as PaymentRequestStatus;
    } else {
      nextStatus = PaymentRequestStatus.DISPUTED;
    }

    await tx.paymentRequest.update({
      where: { id: current.id },
      data: { status: nextStatus, refundAmount },
    });
    const eventType = disputeIsClosed(disputeStatus)
      ? PaymentRequestEventType.DISPUTE_CLOSED
      : stripeEvent.stripeEventType === "charge.dispute.created"
        ? PaymentRequestEventType.DISPUTE_OPENED
        : PaymentRequestEventType.DISPUTE_UPDATED;
    await appendEvent(tx, {
      paymentRequestId: current.id,
      eventType,
      stripeEventId: stripeEvent.stripeEventId,
      message: "Dispute status updated by Stripe.",
      metadata: { source: stripeEvent.stripeEventType, disputeStatus },
    });
    payoutHoldOrderId = await syncTradeOrderFromPaymentRequest(
      tx,
      {
        id: current.id,
        status: nextStatus,
        grossAmount: current.grossAmount,
        refundAmount,
        paidAt: current.paidAt,
        stripeProcessingFeeAmount: current.stripeProcessingFeeAmount,
      },
      "dispute",
    );
    payoutHoldRequired = nextStatus === PaymentRequestStatus.DISPUTED;
    if (current.releasedAt) {
      await markReconciliationRequired(tx, {
        paymentRequestId: current.id,
        message: "A dispute changed after manual seller payout and requires reconciliation.",
        metadata: { source: stripeEvent.stripeEventType, reason: "dispute_after_release" },
      });
    }
    await reconcileSettlementAfterVerifiedDispute(tx, {
      paymentRequestId: current.id,
      stripeSourceId: dispute.id,
      stripeEventId: stripeEvent.stripeEventId,
      stripeEventType: stripeEvent.stripeEventType,
      stripeEventCreatedAt: stripeEvent.stripeEventCreatedAt,
      disputeStatus,
      disputeAmount: dispute.amount,
      disputeCurrency: dispute.currency,
    });
  });
  if (payoutHoldOrderId && payoutHoldRequired) {
    try {
      await sendTradeOrderNotification({
        orderId: payoutHoldOrderId,
        kind: "payout_on_hold",
        recipient: "seller",
        idempotencyKey: `trade82-payout-hold-dispute-${stripeEvent.stripeEventId}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: "payout_on_hold" });
    }
  }
  return true;
}
