import "server-only";

import {
  PartnerProfileStatus,
  PaymentRequestStatus,
  Prisma,
  ReferralAttributionStatus,
  ReferralSubjectType,
  SettlementEventType,
  SettlementLegStatus,
  SettlementLegType,
  SettlementStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isStripeConnectSettlementLedgerEnabled } from "@/lib/stripe-connect-settlement-feature";
import { calculateStripeConnectSettlementFinancials } from "@/lib/stripe-connect-settlement-financials";
import {
  calculateSettlementHoldUntil,
  settlementIdempotencyKey,
  settlementLegIdempotencyKey,
} from "@/lib/stripe-connect-settlement-rules";

type Tx = Prisma.TransactionClient;

export {
  calculateSettlementHoldUntil,
  settlementIdempotencyKey,
  settlementLegIdempotencyKey,
} from "@/lib/stripe-connect-settlement-rules";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function lockReferralAttribution(
  tx: Tx,
  {
    referredUserId,
    partnerProfileId,
  }: {
    referredUserId: string;
    partnerProfileId: string;
  },
) {
  const existing = await tx.referralAttribution.findUnique({
    where: { referredUserId },
  });
  if (existing) return { attribution: existing, created: false };

  const partner = await tx.partnerProfile.findUnique({
    where: { id: partnerProfileId },
  });
  if (!partner || partner.status !== PartnerProfileStatus.ACTIVE) {
    throw new Error("An active partner profile is required for referral attribution.");
  }
  if (partner.userId === referredUserId) {
    throw new Error("A user cannot refer themselves.");
  }

  try {
    const attribution = await tx.referralAttribution.create({
      data: {
        referredUserId,
        partnerProfileId: partner.id,
        referralCode: partner.referralCode,
        status: ReferralAttributionStatus.LOCKED,
      },
    });
    return { attribution, created: true };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const attribution = await tx.referralAttribution.findUniqueOrThrow({
      where: { referredUserId },
    });
    return { attribution, created: false };
  }
}

type PendingSettlementInput = {
  paymentRequestId: string;
  referralAttributionId?: string | null;
  paidAt?: Date;
};

// This service creates accounting records only. It deliberately has no Stripe
// client dependency and never creates Transfers, TransfersReversals, or payouts.
export async function createPendingSettlementForVerifiedPayment(
  tx: Tx,
  { paymentRequestId, referralAttributionId, paidAt }: PendingSettlementInput,
) {
  const existing = await tx.settlement.findUnique({
    where: { paymentRequestId },
    include: { legs: true },
  });
  if (existing) return { settlement: existing, created: false };

  const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      grossAmount: true,
      platformFeeAmount: true,
      sellerPayableAmount: true,
      currency: true,
      sellerCompanyId: true,
      buyerCompany: { select: { ownerUserId: true } },
      sellerCompany: { select: { ownerUserId: true } },
      tradeOrderByPaymentRequest: { select: { id: true } },
    },
  });

  if (paymentRequest.status !== PaymentRequestStatus.PAID) {
    throw new Error("A settlement can only be created for a Stripe-confirmed paid payment request.");
  }
  const paymentConfirmedAt = paidAt ?? paymentRequest.paidAt;
  if (!paymentConfirmedAt) {
    throw new Error("A paid payment request must include its verified payment timestamp.");
  }
  if (!paymentRequest.tradeOrderByPaymentRequest) {
    throw new Error("A trade order is required before creating a settlement ledger.");
  }

  const attribution = referralAttributionId
    ? await tx.referralAttribution.findUnique({
        where: { id: referralAttributionId },
        include: { partnerProfile: true },
      })
    : null;
  if (referralAttributionId && (!attribution || attribution.status !== ReferralAttributionStatus.LOCKED)) {
    throw new Error("The selected referral attribution must be locked.");
  }
  let referralSubjectType: ReferralSubjectType | null = null;
  if (attribution) {
    const refersBuyer = attribution.referredUserId === paymentRequest.buyerCompany.ownerUserId;
    const refersSeller = attribution.referredUserId === paymentRequest.sellerCompany.ownerUserId;
    if (refersBuyer === refersSeller) {
      throw new Error("The selected referral attribution must belong to exactly one transaction party.");
    }
    referralSubjectType = refersBuyer ? ReferralSubjectType.BUYER : ReferralSubjectType.SELLER;
  }
  const hasReferralAttribution = Boolean(attribution);
  const financials = calculateStripeConnectSettlementFinancials({
    grossAmount: paymentRequest.grossAmount,
    currency: paymentRequest.currency,
    hasReferralAttribution,
  });
  if (
    financials.platformFeeAmount !== paymentRequest.platformFeeAmount ||
    financials.sellerPayableAmount !== paymentRequest.sellerPayableAmount
  ) {
    throw new Error("Payment request financials do not match the settlement calculation.");
  }

  const holdUntil = calculateSettlementHoldUntil(paymentConfirmedAt);
  const idempotencyKey = settlementIdempotencyKey(paymentRequest.id);
  const legs = [
    {
      type: SettlementLegType.SELLER_PAYABLE,
      recipientCompanyId: paymentRequest.sellerCompanyId,
      amount: financials.sellerPayableAmount,
    },
    {
      type: SettlementLegType.PLATFORM_FEE,
      amount: financials.trade82RetainedAmountBeforeStripeFees,
    },
    ...(hasReferralAttribution
      ? [{
          type: SettlementLegType.PARTNER_REFERRAL,
          recipientUserId: attribution!.partnerProfile.userId,
          partnerProfileId: attribution!.partnerProfileId,
          amount: financials.partnerReferralAmount,
        }]
      : []),
  ];

  try {
    const settlement = await tx.settlement.create({
      data: {
        paymentRequestId: paymentRequest.id,
        tradeOrderId: paymentRequest.tradeOrderByPaymentRequest.id,
        ...(hasReferralAttribution
          ? {
              referralAttributionId: attribution!.id,
              referralPartnerProfileId: attribution!.partnerProfileId,
              referralCodeSnapshot: attribution!.referralCode,
              referralSubjectType,
              referredUserIdSnapshot: attribution!.referredUserId,
            }
          : {}),
        ...financials,
        holdUntil,
        status: SettlementStatus.HOLD,
        idempotencyKey,
        legs: {
          create: legs.map((leg) => ({
            ...leg,
            currency: financials.currency,
            holdUntil,
            status: SettlementLegStatus.HOLD,
            idempotencyKey: settlementLegIdempotencyKey(paymentRequest.id, leg.type),
          })),
        },
        events: {
          create: [
            {
              eventType: SettlementEventType.CREATED,
              message: "Pending settlement ledger created after verified payment confirmation.",
              idempotencyKey: `${idempotencyKey}:event:created`,
            },
            {
              eventType: SettlementEventType.LEGS_CREATED,
              message: "Seller, platform, and applicable referral ledger legs were created on hold.",
              idempotencyKey: `${idempotencyKey}:event:legs-created`,
            },
            {
              eventType: SettlementEventType.HOLD_STARTED,
              message: "Settlement is held for fourteen days before any future transfer eligibility.",
              idempotencyKey: `${idempotencyKey}:event:hold-started`,
            },
          ],
        },
      },
      include: { legs: true },
    });
    return { settlement, created: true };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const settlement = await tx.settlement.findUniqueOrThrow({
      where: { paymentRequestId },
      include: { legs: true },
    });
    return { settlement, created: false };
  }
}

// A later webhook integration can call this wrapper only after its existing
// verified payment path succeeds. With the default mode off it is a no-op, so
// normal checkout, manual payouts, refunds, and disputes remain unchanged.
export async function maybeCreatePendingSettlementForVerifiedPayment(input: PendingSettlementInput) {
  if (!isStripeConnectSettlementLedgerEnabled()) return null;
  return getDb().$transaction(
    (tx) => createPendingSettlementForVerifiedPayment(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
