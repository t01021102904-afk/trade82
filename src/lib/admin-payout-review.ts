import "server-only";

import { getDb } from "@/lib/db";

export type AdminPayoutReviewTransaction = {
  orderId: string;
  orderNumber: string;
  transaction: {
    paymentRequestId: string;
    orderStatus: string;
    paymentStatus: string;
    paymentFlow: string;
    paidAt: Date | null;
    currency: string;
    grossAmount: number;
    holdUntil: Date;
  };
  payment: {
    status: string;
    grossAmount: number;
    platformFeeAmount: number;
    sellerPayableAmount: number;
    stripeProcessingFeeAmount: number | null;
    refundAmount: number;
    disputes: Array<{ id: string; status: string; amount: number }>;
  };
  buyer: {
    company: string;
    contactName: string | null;
    email: string;
    phone: string | null;
    country: string;
  };
  sellerPayout: Record<string, unknown> | null;
  partnerPayout: Record<string, unknown> | null;
  reconciliation: {
    buyerTotalCharge: number;
    merchandiseAmount: number;
    buyerServiceFee: number | null;
    sellerPayout: number | null;
    partnerCommission: number;
    trade82Retained: number | null;
    stripeProcessingFee: number | null;
    refundAdjustment: number;
    unexplainedDifference: number | null;
    balanced: boolean;
  };
  warnings: string[];
  auditEvents: Array<{ id: string; eventType: string; message: string | null; createdAt: Date }>;
};

export async function listAdminPayoutReviewTransactions(requestedId?: string | null) {
  const orders = await getDb().tradeOrder.findMany({
    where: {
      paymentRequest: { status: { in: ["PAID", "RELEASED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] } },
      ...(requestedId
        ? {
            OR: [
              { id: requestedId },
              { payout: { is: { id: requestedId } } },
              { partnerPayouts: { some: { id: requestedId } } },
            ],
          }
        : {}),
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      paymentStatus: true,
      paidAt: true,
      productAmount: true,
      grossAmount: true,
      buyerCompanyName: true,
      buyerContactName: true,
      buyerEmail: true,
      buyerPhone: true,
      buyerCountry: true,
      paymentRequest: {
        select: {
          id: true,
          status: true,
          grossAmount: true,
          platformFeeAmount: true,
          sellerPayableAmount: true,
          stripeProcessingFeeAmount: true,
          refundAmount: true,
          currency: true,
          paidAt: true,
          requiresManualReconciliation: true,
          disputes: { select: { id: true, status: true, amount: true } },
        },
      },
      payout: {
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          currency: true,
          grossAmount: true,
          platformFeeAmount: true,
          sellerPayableAmount: true,
          refundAdjustmentAmount: true,
          manualAdjustmentAmount: true,
          finalPayoutAmount: true,
          processingFeeAmount: true,
          bankNameSnapshot: true,
          accountNumberLast4: true,
          sentAt: true,
          failedAt: true,
          externalTransferReference: true,
          externalBankReference: true,
          sellerCompany: { select: { legalName: true, tradeName: true } },
        },
      },
      partnerPayouts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          currency: true,
          originalCommissionAmount: true,
          reversalAdjustmentAmount: true,
          finalPayoutAmount: true,
          holdUntil: true,
          bankNameSnapshot: true,
          accountHolderSnapshot: true,
          accountNumberLast4: true,
          accountNumberMasked: true,
          partnerLegalNameSnapshot: true,
          partnerDisplayNameSnapshot: true,
          partnerOrganizationSnapshot: true,
          partnerEmailSnapshot: true,
          partnerPhoneSnapshot: true,
          partnerResidenceCountrySnapshot: true,
          payoutCurrencySnapshot: true,
          snapshotCapturedAt: true,
          requiresManualReconciliation: true,
          sentAt: true,
          failedAt: true,
          externalTransferReference: true,
          externalBankReference: true,
          partnerProfile: { select: { status: true } },
          payoutProfile: { select: { status: true } },
        },
      },
      connectSettlement: {
        select: {
          id: true,
          status: true,
          paymentFlow: true,
          grossAmount: true,
          platformFeeAmount: true,
          sellerPayableAmount: true,
          partnerReferralAmount: true,
          trade82RetainedAmountBeforeStripeFees: true,
          currency: true,
          holdUntil: true,
          events: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, eventType: true, message: true, createdAt: true },
          },
        },
      },
    },
  });

  return orders.map<AdminPayoutReviewTransaction>((order) => {
    const payment = order.paymentRequest;
    const settlement = order.connectSettlement;
    const partnerPayout = order.partnerPayouts[0] ?? null;
    const sellerPayout = order.payout;
    // The persisted payment model has no separate buyer service-fee field.
    const buyerServiceFee = null;
    const unexplainedDifference = settlement
      ? settlement.grossAmount - settlement.sellerPayableAmount - settlement.platformFeeAmount - settlement.partnerReferralAmount - settlement.trade82RetainedAmountBeforeStripeFees
      : null;
    const warnings = [
      payment.requiresManualReconciliation ? "reconciliation_required" : null,
      payment.refundAmount > 0 ? "refund_present" : null,
      payment.disputes.some((item) => !["won", "lost", "prevented", "warning_closed", "charge_refunded"].includes(item.status)) ? "active_dispute" : null,
      partnerPayout?.requiresManualReconciliation ? "partner_reconciliation_required" : null,
    ].filter((value): value is string => Boolean(value));
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      transaction: {
        paymentRequestId: payment.id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentFlow: settlement?.paymentFlow ?? "SCT",
        paidAt: payment.paidAt ?? order.paidAt,
        currency: payment.currency,
        grossAmount: payment.grossAmount,
        holdUntil: settlement?.holdUntil ?? new Date(0),
      },
      payment: {
        status: payment.status,
        grossAmount: payment.grossAmount,
        platformFeeAmount: payment.platformFeeAmount,
        sellerPayableAmount: payment.sellerPayableAmount,
        stripeProcessingFeeAmount: payment.stripeProcessingFeeAmount,
        refundAmount: payment.refundAmount,
        disputes: payment.disputes,
      },
      buyer: {
        company: order.buyerCompanyName,
        contactName: order.buyerContactName,
        email: order.buyerEmail,
        phone: order.buyerPhone,
        country: order.buyerCountry,
      },
      sellerPayout: sellerPayout,
      partnerPayout,
      reconciliation: {
        buyerTotalCharge: payment.grossAmount,
        merchandiseAmount: order.productAmount,
        buyerServiceFee: Number.isFinite(buyerServiceFee) ? buyerServiceFee : null,
        sellerPayout: sellerPayout?.finalPayoutAmount ?? settlement?.sellerPayableAmount ?? null,
        partnerCommission: partnerPayout?.finalPayoutAmount ?? settlement?.partnerReferralAmount ?? 0,
        trade82Retained: settlement?.trade82RetainedAmountBeforeStripeFees ?? null,
        stripeProcessingFee: payment.stripeProcessingFeeAmount,
        refundAdjustment: payment.refundAmount,
        unexplainedDifference,
        balanced: unexplainedDifference === 0,
      },
      warnings,
      auditEvents: settlement?.events ?? [],
    };
  });
}
