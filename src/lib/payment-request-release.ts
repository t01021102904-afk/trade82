import type { PaymentRequestStatus, Prisma } from "@/generated/prisma/client";

const PAID_STATUS: PaymentRequestStatus = "PAID";

export type PaymentRequestReleaseLocker = {
  paymentRequest: {
    updateMany(args: {
      where: Prisma.PaymentRequestWhereInput;
      data:
        | Prisma.PaymentRequestUpdateManyMutationInput
        | Prisma.PaymentRequestUncheckedUpdateManyInput;
    }): Promise<{ count: number }>;
  };
};

// The state change is kept in one conditional update so only one concurrent admin
// request can record an external payout for a payment request.
export async function claimPaymentRequestRelease({
  locker,
  paymentRequestId,
  sellerPayableAmount,
  releasedAt,
  payoutReference,
  payoutDate,
  payoutNote,
  releasedByUserId,
}: {
  locker: PaymentRequestReleaseLocker;
  paymentRequestId: string;
  sellerPayableAmount: number;
  releasedAt: Date;
  payoutReference: string;
  payoutDate: Date;
  payoutNote: string;
  releasedByUserId: string;
}) {
  const released = await locker.paymentRequest.updateMany({
    where: {
      id: paymentRequestId,
      status: PAID_STATUS,
      refundAmount: 0,
      releasedAt: null,
      manualPayoutReference: null,
      requiresManualReconciliation: false,
    },
    data: {
      status: "RELEASED",
      releasedAt,
      manualPayoutReference: payoutReference,
      manualPayoutDate: payoutDate,
      manualPayoutNote: payoutNote,
      sellerReleasedAmount: sellerPayableAmount,
      releasedByUserId,
    },
  });
  return released.count === 1;
}
