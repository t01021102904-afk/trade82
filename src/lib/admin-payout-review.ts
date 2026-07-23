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
    paymentDate: Date | null;
    currency: string;
    grossAmount: number;
    merchandiseAmount: number;
    totalBuyerCharge: number;
    buyerServiceFee: number | null;
    stripeProcessingFee: number | null;
    refundAmount: number;
    disputes: Array<{ id: string; status: string; amount: number }>;
    holdUntil: Date;
    productName: string | null;
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
  seller: {
    company: string;
    contactName: string | null;
    email: string;
    phone: string | null;
    country: string;
  };
  sellerPayout: {
    id: string;
    payoutNumber: string;
    status: string;
    currency: string;
    grossAmount: number;
    platformFeeAmount: number;
    sellerPayableAmount: number;
    refundAdjustmentAmount: number;
    manualAdjustmentAmount: number;
    finalPayoutAmount: number;
    processingFeeAmount: number | null;
    legalCompanyName: string;
    tradeName: string | null;
    accountCountry: string;
    accountHolder: string;
    bankNameSnapshot: string;
    accountNumberLast4: string | null;
    swiftBicSnapshot: string | null;
    officialBankWebsiteSnapshot: string | null;
    payoutCurrency: string;
    sentAt: Date | null;
    failedAt: Date | null;
    externalTransferReference: string | null;
    externalBankReference: string | null;
    approvedAt: Date | null;
    preparedAt: Date | null;
    adjustments: Array<{
      id: string;
      adjustmentType: string;
      amount: number;
      currency: string;
      reason: string;
      internalNote: string | null;
      requiresManualReconciliation: boolean;
      createdAt: Date;
      createdByUser: { displayName: string; email: string };
    }>;
  } | null;
  hasPartnerAttribution: boolean;
  partnerAttributionId: string | null;
  partnerSettlementLegId: string | null;
  partnerExpectedCommissionAmount: number;
  partnerPreparationState: "NOT_APPLICABLE" | "NOT_PREPARED" | "PREPARED";
  partnerPayout: {
    id: string;
    payoutNumber: string;
    status: string;
    currency: string;
    originalCommissionAmount: number;
    reversalAdjustmentAmount: number;
    finalPayoutAmount: number;
    holdUntil: Date;
    accountCountrySnapshot: string | null;
    bankNameSnapshot: string | null;
    accountHolderSnapshot: string | null;
    accountNumberLast4: string | null;
    accountNumberMasked: string | null;
    payoutCurrencySnapshot: string | null;
    partnerLegalNameSnapshot: string | null;
    partnerDisplayNameSnapshot: string | null;
    partnerOrganizationSnapshot: string | null;
    partnerEmailSnapshot: string | null;
    partnerPhoneSnapshot: string | null;
    partnerResidenceCountrySnapshot: string | null;
    snapshotCapturedAt: Date | null;
    requiresManualReconciliation: boolean;
    sentAt: Date | null;
    failedAt: Date | null;
    externalTransferReference: string | null;
    externalBankReference: string | null;
    partnerStatus: string;
    payoutProfileStatus: string | null;
    attributionId: string | null;
  } | null;
  reconciliation: {
    buyerTotalCharge: number;
    merchandiseAmount: number;
    buyerServiceFee: number | null;
    sellerPayout: number | null;
    partnerCommission: number;
    trade82Retained: number | null;
    stripeProcessingFee: number | null;
    refundAdjustment: number;
    grossAllocationDifference: number | null;
    platformFeeAllocationDifference: number | null;
    grossAllocationBalanced: boolean;
    platformFeeAllocationBalanced: boolean;
    currencyMismatch: boolean;
    unexplainedDifference: number | null;
    balanced: boolean;
  };
  warnings: string[];
  auditEvents: Array<{ id: string; eventType: string; message: string | null; createdAt: Date }>;
};

export type AdminPayoutReconciliationInput = {
  grossAmount: number;
  sellerAllocation: number;
  partnerAllocation: number;
  platformFeeAmount: number;
  trade82RetainedAmountBeforeStripeFees: number;
  paymentCurrency: string;
  settlementCurrency: string;
};

export function calculateAdminPayoutReconciliation(input: AdminPayoutReconciliationInput) {
  const currencyMismatch = input.paymentCurrency.toLowerCase() !== input.settlementCurrency.toLowerCase();
  const grossAllocationDifference =
    input.grossAmount - input.sellerAllocation - input.partnerAllocation - input.trade82RetainedAmountBeforeStripeFees;
  const platformFeeAllocationDifference =
    input.platformFeeAmount - input.partnerAllocation - input.trade82RetainedAmountBeforeStripeFees;
  const grossAllocationBalanced = !currencyMismatch && grossAllocationDifference === 0;
  const platformFeeAllocationBalanced = !currencyMismatch && platformFeeAllocationDifference === 0;

  return {
    grossAllocationDifference,
    platformFeeAllocationDifference,
    grossAllocationBalanced,
    platformFeeAllocationBalanced,
    currencyMismatch,
    balanced: grossAllocationBalanced && platformFeeAllocationBalanced,
  };
}

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
              { connectSettlement: { is: { legs: { some: { id: requestedId } } } } },
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
      sellerCompanyName: true,
      sellerContactName: true,
      sellerEmail: true,
      sellerPhone: true,
      sellerCountry: true,
      items: { take: 1, orderBy: { createdAt: "asc" }, select: { productName: true } },
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
          swiftBicSnapshot: true,
          officialBankWebsiteSnapshot: true,
          sentAt: true,
          failedAt: true,
          externalTransferReference: true,
          externalBankReference: true,
          approvedAt: true,
          preparedAt: true,
          payoutProfile: { select: { country: true, accountHolder: true, payoutCurrency: true } },
          adjustments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              adjustmentType: true,
              amount: true,
              currency: true,
              reason: true,
              internalNote: true,
              requiresManualReconciliation: true,
              createdAt: true,
              createdByUser: { select: { displayName: true, email: true } },
            },
          },
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
          accountCountrySnapshot: true,
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
          referralAttributionId: true,
          referralAttribution: { select: { id: true } },
          legs: {
            where: { type: "PARTNER_REFERRAL" },
            take: 1,
            select: { id: true, type: true, amount: true, currency: true, holdUntil: true, status: true, partnerProfileId: true },
          },
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
    const partnerLeg = settlement?.legs[0] ?? null;
    const hasPartnerAttribution = Boolean(settlement?.referralAttribution?.id && partnerLeg?.id && partnerLeg.partnerProfileId);
    const partnerAttributionId = hasPartnerAttribution ? settlement?.referralAttribution?.id ?? null : null;
    const partnerSettlementLegId = hasPartnerAttribution ? partnerLeg?.id ?? null : null;
    const sellerPayout = order.payout;
    // The persisted payment model has no separate buyer service-fee field.
    const buyerServiceFee = null;
    const allocation = settlement
      ? calculateAdminPayoutReconciliation({
          grossAmount: settlement.grossAmount,
          sellerAllocation: settlement.sellerPayableAmount,
          partnerAllocation: settlement.partnerReferralAmount,
          platformFeeAmount: settlement.platformFeeAmount,
          trade82RetainedAmountBeforeStripeFees: settlement.trade82RetainedAmountBeforeStripeFees,
          paymentCurrency: payment.currency,
          settlementCurrency: settlement.currency,
        })
      : null;
    const unexplainedDifference = allocation?.grossAllocationDifference ?? null;
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
        paymentDate: payment.paidAt ?? order.paidAt,
        currency: payment.currency,
        grossAmount: payment.grossAmount,
        merchandiseAmount: order.productAmount,
        totalBuyerCharge: payment.grossAmount,
        buyerServiceFee,
        stripeProcessingFee: payment.stripeProcessingFeeAmount,
        refundAmount: payment.refundAmount,
        disputes: payment.disputes,
        holdUntil: settlement?.holdUntil ?? new Date(0),
        productName: order.items[0]?.productName ?? null,
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
      seller: {
        company: order.sellerCompanyName,
        contactName: order.sellerContactName,
        email: order.sellerEmail,
        phone: order.sellerPhone,
        country: order.sellerCountry,
      },
      sellerPayout: sellerPayout
        ? {
            id: sellerPayout.id,
            payoutNumber: sellerPayout.payoutNumber,
            status: sellerPayout.status,
            currency: sellerPayout.currency,
            grossAmount: sellerPayout.grossAmount,
            platformFeeAmount: sellerPayout.platformFeeAmount,
            sellerPayableAmount: sellerPayout.sellerPayableAmount,
            refundAdjustmentAmount: sellerPayout.refundAdjustmentAmount,
            manualAdjustmentAmount: sellerPayout.manualAdjustmentAmount,
            finalPayoutAmount: sellerPayout.finalPayoutAmount,
            processingFeeAmount: sellerPayout.processingFeeAmount,
            legalCompanyName: sellerPayout.sellerCompany.legalName,
            tradeName: sellerPayout.sellerCompany.tradeName,
            accountCountry: sellerPayout.payoutProfile.country,
            accountHolder: sellerPayout.payoutProfile.accountHolder,
            bankNameSnapshot: sellerPayout.bankNameSnapshot,
            accountNumberLast4: sellerPayout.accountNumberLast4,
            swiftBicSnapshot: sellerPayout.swiftBicSnapshot,
            officialBankWebsiteSnapshot: sellerPayout.officialBankWebsiteSnapshot,
            payoutCurrency: sellerPayout.payoutProfile.payoutCurrency,
            sentAt: sellerPayout.sentAt,
            failedAt: sellerPayout.failedAt,
            externalTransferReference: sellerPayout.externalTransferReference,
            externalBankReference: sellerPayout.externalBankReference,
            approvedAt: sellerPayout.approvedAt,
            preparedAt: sellerPayout.preparedAt,
            adjustments: sellerPayout.adjustments,
          }
        : null,
      hasPartnerAttribution,
      partnerAttributionId,
      partnerSettlementLegId,
      partnerExpectedCommissionAmount: hasPartnerAttribution ? partnerLeg?.amount ?? 0 : 0,
      partnerPreparationState: !hasPartnerAttribution ? "NOT_APPLICABLE" : partnerPayout ? "PREPARED" : "NOT_PREPARED",
      partnerPayout: partnerPayout
        ? {
            id: partnerPayout.id,
            payoutNumber: partnerPayout.payoutNumber,
            status: partnerPayout.status,
            currency: partnerPayout.currency,
            originalCommissionAmount: partnerPayout.originalCommissionAmount,
            reversalAdjustmentAmount: partnerPayout.reversalAdjustmentAmount,
            finalPayoutAmount: partnerPayout.finalPayoutAmount,
            holdUntil: partnerPayout.holdUntil,
            accountCountrySnapshot: partnerPayout.accountCountrySnapshot,
            bankNameSnapshot: partnerPayout.bankNameSnapshot,
            accountHolderSnapshot: partnerPayout.accountHolderSnapshot,
            accountNumberLast4: partnerPayout.accountNumberLast4,
            accountNumberMasked: partnerPayout.accountNumberMasked,
            payoutCurrencySnapshot: partnerPayout.payoutCurrencySnapshot,
            partnerLegalNameSnapshot: partnerPayout.partnerLegalNameSnapshot,
            partnerDisplayNameSnapshot: partnerPayout.partnerDisplayNameSnapshot,
            partnerOrganizationSnapshot: partnerPayout.partnerOrganizationSnapshot,
            partnerEmailSnapshot: partnerPayout.partnerEmailSnapshot,
            partnerPhoneSnapshot: partnerPayout.partnerPhoneSnapshot,
            partnerResidenceCountrySnapshot: partnerPayout.partnerResidenceCountrySnapshot,
            snapshotCapturedAt: partnerPayout.snapshotCapturedAt,
            requiresManualReconciliation: partnerPayout.requiresManualReconciliation,
            sentAt: partnerPayout.sentAt,
            failedAt: partnerPayout.failedAt,
            externalTransferReference: partnerPayout.externalTransferReference,
            externalBankReference: partnerPayout.externalBankReference,
            partnerStatus: partnerPayout.partnerProfile.status,
            payoutProfileStatus: partnerPayout.payoutProfile?.status ?? null,
            attributionId: partnerAttributionId,
          }
        : null,
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
        grossAllocationDifference: allocation?.grossAllocationDifference ?? null,
        platformFeeAllocationDifference: allocation?.platformFeeAllocationDifference ?? null,
        grossAllocationBalanced: allocation?.grossAllocationBalanced ?? false,
        platformFeeAllocationBalanced: allocation?.platformFeeAllocationBalanced ?? false,
        currencyMismatch: allocation?.currencyMismatch ?? false,
        balanced: allocation?.balanced ?? false,
      },
      warnings,
      auditEvents: settlement?.events ?? [],
    };
  });
}
