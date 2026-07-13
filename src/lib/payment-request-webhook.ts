import type { PaymentRequestStatus, Prisma } from "@/generated/prisma/client";

const PENDING_STATUS: PaymentRequestStatus = "PENDING";

export type PaymentRequestWebhookEventLocker = {
  paymentRequestWebhookEvent: {
    create(args: {
      data: {
        paymentRequestId: string;
        stripeEventId: string;
        stripeEventType: string;
      };
    }): Promise<unknown>;
  };
};

export type PaymentRequestPaidLocker = {
  paymentRequest: {
    updateMany(args: {
      where: Prisma.PaymentRequestWhereInput;
      data: Prisma.PaymentRequestUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
};

function isDuplicateWebhookEventError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: unknown }).code === "P2002";
}

// The unique Stripe event ID is the idempotency boundary for all payment webhooks.
export async function claimPaymentRequestWebhookEvent({
  locker,
  paymentRequestId,
  stripeEventId,
  stripeEventType,
}: {
  locker: PaymentRequestWebhookEventLocker;
  paymentRequestId: string;
  stripeEventId: string;
  stripeEventType: string;
}) {
  try {
    await locker.paymentRequestWebhookEvent.create({
      data: { paymentRequestId, stripeEventId, stripeEventType },
    });
    return true;
  } catch (error) {
    if (isDuplicateWebhookEventError(error)) return false;
    throw error;
  }
}

// The status condition makes payment confirmation one-way and race-safe.
export async function claimPendingPaymentRequestPaid({
  locker,
  paymentRequestId,
  data,
}: {
  locker: PaymentRequestPaidLocker;
  paymentRequestId: string;
  data: Prisma.PaymentRequestUpdateManyMutationInput;
}) {
  const result = await locker.paymentRequest.updateMany({
    where: { id: paymentRequestId, status: PENDING_STATUS },
    data,
  });
  return result.count === 1;
}
