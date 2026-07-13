import "server-only";

import {
  OrderPayoutStatus,
  Prisma,
  SellerPayoutAdjustmentType,
  SellerPayoutEventType,
  SellerPayoutStatus,
  TradeOrderEventType,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { decryptPayoutData, encryptPayoutData } from "@/lib/payout-crypto";
import { claimPaymentRequestRelease } from "@/lib/payment-request-release";
import { appendTradeOrderEvent, nextSellerPayoutNumber } from "@/lib/trade-orders";
import { sellerPayoutEligibility, type PayoutEligibility } from "@/lib/seller-payout-rules";
import { sendTradeOrderNotification } from "@/lib/trade-order-notifications";
import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";
import {
  calculatePayoutAdjustmentTotals,
  isSellerPayoutAdjustmentType,
  type PayoutAdjustmentEntry,
  type SellerPayoutAdjustmentType as AdjustmentType,
} from "@/lib/seller-payout-adjustment-rules";

type Tx = Prisma.TransactionClient;

const ACTIVE_DISPUTE_STATUSES = new Set([
  "needs_response",
  "warning_needs_response",
  "under_review",
  "warning_under_review",
]);

function prismaBytes(value: Uint8Array) {
  return Uint8Array.from(value);
}

export { sellerPayoutEligibility, type PayoutEligibility } from "@/lib/seller-payout-rules";

async function addPayoutEvent(
  tx: Tx,
  payoutId: string,
  eventType: SellerPayoutEventType,
  actorUserId?: string,
  message?: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.sellerPayoutEvent.create({
    data: {
      payoutId,
      eventType,
      ...(actorUserId ? { actorUserId } : {}),
      ...(message ? { message } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
}

async function orderForPayout(tx: Tx, orderId: string) {
  return tx.tradeOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      paymentRequest: { include: { disputes: true } },
      payout: true,
      sellerCompany: { include: { sellerPayoutProfile: { include: { bankDirectory: true } } } },
    },
  });
}

function profileAccountNumber(profile: {
  accountNumberCiphertext: Uint8Array | null;
  accountNumberIv: Uint8Array | null;
  accountNumberAuthTag: Uint8Array | null;
  accountNumberKeyVersion: string | null;
}) {
  if (
    !profile.accountNumberCiphertext ||
    !profile.accountNumberIv ||
    !profile.accountNumberAuthTag ||
    !profile.accountNumberKeyVersion
  ) {
    throw new Error("Verified payout profile is missing encrypted account instructions.");
  }
  return decryptPayoutData({
    ciphertext: Buffer.from(profile.accountNumberCiphertext),
    iv: Buffer.from(profile.accountNumberIv),
    authTag: Buffer.from(profile.accountNumberAuthTag),
    keyVersion: profile.accountNumberKeyVersion,
  });
}

export async function getSellerPayoutEligibility(orderId: string): Promise<PayoutEligibility> {
  const order = await getDb().tradeOrder.findUnique({
    where: { id: orderId },
    include: {
      paymentRequest: { include: { disputes: true } },
      payout: true,
      sellerCompany: { include: { sellerPayoutProfile: true } },
    },
  });
  if (!order) return { ready: false, reasons: ["Order was not found."] };
  return sellerPayoutEligibility({
    paymentStatus: order.paymentRequest.status,
    orderPaymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    orderPayoutStatus: order.payoutStatus,
    refundAmount: order.paymentRequest.refundAmount,
    hasActiveDispute: order.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status)),
    payoutProfileStatus: order.sellerCompany.sellerPayoutProfile?.status ?? null,
    sellerPayableAmount: order.sellerPayableAmount,
    existingPayoutStatus: order.payout?.status ?? null,
  });
}

export async function prepareSellerPayout({ orderId, actorUserId }: { orderId: string; actorUserId: string }) {
  return getDb().$transaction(
    async (tx) => {
      const order = await orderForPayout(tx, orderId);
      const profile = order.sellerCompany.sellerPayoutProfile;
      const eligibility = sellerPayoutEligibility({
        paymentStatus: order.paymentRequest.status,
        orderPaymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        orderPayoutStatus: order.payoutStatus,
        refundAmount: order.paymentRequest.refundAmount,
        hasActiveDispute: order.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status)),
        payoutProfileStatus: profile?.status ?? null,
        sellerPayableAmount: order.sellerPayableAmount,
        existingPayoutStatus: order.payout?.status ?? null,
      });
      if (!eligibility.ready) {
        await appendTradeOrderEvent(tx, {
          orderId: order.id,
          eventType: TradeOrderEventType.PAYOUT_HOLD,
          actorUserId,
          message: "Payout preparation was blocked.",
          metadata: { reasons: eligibility.reasons },
        });
        throw new Error(eligibility.reasons.join(" "));
      }
      if (!profile) throw new Error("Seller payout profile is not available.");

      const accountNumber = profileAccountNumber(profile);
      const beneficiary = encryptPayoutData(
        JSON.stringify({
          country: profile.country,
          bankName: profile.bankName,
          branchName: profile.branchName,
          accountHolder: profile.accountHolder,
          accountNumber,
          accountType: profile.accountType,
          bankCode: profile.bankCode,
          swiftBic: profile.swiftBic,
          bankAddress: profile.bankAddress,
          beneficiaryAddress: profile.beneficiaryAddress,
          payoutCurrency: profile.payoutCurrency,
          intermediaryBankName: profile.intermediaryBankName,
          intermediaryBankSwift: profile.intermediaryBankSwift,
          intermediaryBankAddress: profile.intermediaryBankAddress,
          payoutMemo: profile.payoutMemo,
        }),
      );
      const payout = await tx.sellerPayout.create({
        data: {
          orderId: order.id,
          sellerCompanyId: order.sellerCompanyId,
          payoutProfileId: profile.id,
          payoutNumber: await nextSellerPayoutNumber(tx),
          status: SellerPayoutStatus.READY,
          currency: order.currency,
          grossAmount: order.grossAmount,
          platformFeeRateBps: order.platformFeeRateBps,
          platformFeeAmount: order.platformFeeAmount,
          sellerPayableAmount: order.sellerPayableAmount,
          finalPayoutAmount: order.sellerPayableAmount,
          processingFeeAmount: order.stripeProcessingFeeAmount,
          beneficiarySnapshotEncrypted: prismaBytes(beneficiary.ciphertext),
          beneficiarySnapshotIv: prismaBytes(beneficiary.iv),
          beneficiarySnapshotAuthTag: prismaBytes(beneficiary.authTag),
          beneficiarySnapshotKeyVersion: beneficiary.keyVersion,
          accountNumberLast4: profile.accountNumberLast4,
          bankNameSnapshot: profile.bankName,
          swiftBicSnapshot: profile.swiftBic,
          officialBankWebsiteSnapshot:
            profile.bankDirectory?.verifiedAt &&
            isSafeOfficialBankWebsite(profile.bankDirectory.officialWebsite)
              ? profile.bankDirectory.officialWebsite
              : null,
          preparedAt: new Date(),
          preparedByUserId: actorUserId,
        },
      });
      await tx.tradeOrder.update({
        where: { id: order.id },
        data: { payoutStatus: OrderPayoutStatus.READY },
      });
      await addPayoutEvent(tx, payout.id, SellerPayoutEventType.CREATED, actorUserId, "Payout prepared.");
      await addPayoutEvent(tx, payout.id, SellerPayoutEventType.READY, actorUserId, "Payout is ready for external bank processing.");
      await appendTradeOrderEvent(tx, {
        orderId: order.id,
        eventType: TradeOrderEventType.PAYOUT_READY,
        actorUserId,
        message: "Manual seller payout prepared.",
      });
      return payout;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setSellerPayoutStatus({
  payoutId,
  actorUserId,
  status,
  failureReason,
}: {
  payoutId: string;
  actorUserId: string;
  status: "HOLD" | "PROCESSING" | "FAILED";
  failureReason?: string;
}) {
  const result = await getDb().$transaction(async (tx) => {
    const payout = await tx.sellerPayout.findUniqueOrThrow({ where: { id: payoutId } });
    if (
      payout.status === SellerPayoutStatus.SENT ||
      payout.status === SellerPayoutStatus.CANCELLED
    ) {
      throw new Error("A sent or cancelled payout cannot be changed.");
    }
    const update = await tx.sellerPayout.updateMany({
      where: { id: payout.id, status: { in: ["READY", "HOLD", "PROCESSING", "FAILED"] } },
      data: {
        status,
        ...(status === "FAILED" ? { failedAt: new Date(), failureReason: failureReason?.trim() || "Payout failed." } : {}),
      },
    });
    if (!update.count) throw new Error("Payout state changed. Refresh and try again.");
    const orderPayoutStatus = status === "HOLD" ? OrderPayoutStatus.HOLD : status === "PROCESSING" ? OrderPayoutStatus.PROCESSING : OrderPayoutStatus.FAILED;
    await tx.tradeOrder.update({ where: { id: payout.orderId }, data: { payoutStatus: orderPayoutStatus } });
    await addPayoutEvent(tx, payout.id, status as SellerPayoutEventType, actorUserId, `Payout marked ${status.toLowerCase()}.`);
    await appendTradeOrderEvent(tx, {
      orderId: payout.orderId,
      eventType: status === "HOLD" ? TradeOrderEventType.PAYOUT_HOLD : status === "PROCESSING" ? TradeOrderEventType.PAYOUT_PROCESSING : TradeOrderEventType.PAYOUT_FAILED,
      actorUserId,
      message: `Manual payout marked ${status.toLowerCase()}.`,
    });
    return { orderId: payout.orderId };
  });
  if (status === "HOLD" || status === "FAILED") {
    try {
      await sendTradeOrderNotification({
        orderId: result.orderId,
        kind: status === "HOLD" ? "payout_on_hold" : "payout_failed",
        recipient: "seller",
        idempotencyKey: `trade82-payout-${status.toLowerCase()}-${payoutId}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: `payout_${status.toLowerCase()}` });
    }
  }
  return result;
}

export async function markSellerPayoutSent({
  payoutId,
  actorUserId,
  externalTransferReference,
  sentAt,
  confirmation,
  externalBankReference,
}: {
  payoutId: string;
  actorUserId: string;
  externalTransferReference: string;
  sentAt: Date;
  confirmation: string;
  externalBankReference?: string;
}) {
  if (!externalTransferReference.trim()) throw new Error("External transfer reference is required.");
  const result = await getDb().$transaction(
    async (tx) => {
      const payout = await tx.sellerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        include: { order: true },
      });
      if (payout.status === SellerPayoutStatus.SENT) return { alreadySent: true, payout };
      if (confirmation.trim() !== payout.payoutNumber && confirmation.trim() !== payout.order.orderNumber) {
        throw new Error("Type the payout number or order number to confirm the external transfer.");
      }
      const changed = await tx.sellerPayout.updateMany({
        where: { id: payout.id, status: { in: ["READY", "PROCESSING"] }, sentAt: null },
        data: {
          status: SellerPayoutStatus.SENT,
          sentAt,
          sentByUserId: actorUserId,
          externalTransferReference: externalTransferReference.trim(),
          externalBankReference: externalBankReference?.trim() || null,
        },
      });
      if (!changed.count) throw new Error("Payout state changed. Refresh and try again.");

      const released = await claimPaymentRequestRelease({
        locker: tx,
        paymentRequestId: payout.order.paymentRequestId,
        sellerPayableAmount: payout.finalPayoutAmount,
        releasedAt: sentAt,
        payoutReference: externalTransferReference.trim(),
        payoutDate: sentAt,
        payoutNote: `Manual payout ${payout.payoutNumber} marked sent.`,
        releasedByUserId: actorUserId,
      });
      if (!released) {
        throw new Error("Payment request is no longer eligible for manual release.");
      }
      await tx.tradeOrder.update({ where: { id: payout.orderId }, data: { payoutStatus: OrderPayoutStatus.SENT } });
      await addPayoutEvent(tx, payout.id, SellerPayoutEventType.SENT, actorUserId, "External payout recorded as sent.");
      await appendTradeOrderEvent(tx, {
        orderId: payout.orderId,
        eventType: TradeOrderEventType.PAYOUT_SENT,
        actorUserId,
        message: "Admin recorded the external seller payout as sent.",
      });
      return { alreadySent: false, payout: await tx.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } }) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (!result.alreadySent) {
    try {
      await sendTradeOrderNotification({
        orderId: result.payout.orderId,
        kind: "payout_sent",
        recipient: "seller",
        idempotencyKey: `trade82-payout-sent-${result.payout.id}`,
      });
    } catch {
      console.error("Trade order notification delivery failed.", { kind: "payout_sent" });
    }
  }
  return result;
}

/**
 * Creates an immutable manual adjustment. For unsent payouts, the materialized
 * totals are re-derived from the immutable base amounts and every adjustment
 * record in the same serializable transaction. A payout already sent to an
 * external bank never has its recorded amount rewritten; the adjustment is a
 * separate reconciliation item that places the order payout on hold.
 */
export async function addSellerPayoutAdjustment({
  payoutId,
  actorUserId,
  adjustmentType,
  amount,
  currency,
  reason,
  internalNote,
  confirmation,
}: {
  payoutId: string;
  actorUserId: string;
  adjustmentType: AdjustmentType;
  amount: number;
  currency: string;
  reason: string;
  internalNote?: string;
  confirmation: string;
}) {
  if (!isSellerPayoutAdjustmentType(adjustmentType)) {
    throw new Error("Adjustment type is invalid.");
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Adjustment amount must be a positive integer minor-unit value.");
  }
  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 1_000) {
    throw new Error("Adjustment reason must be between 3 and 1000 characters.");
  }
  const cleanNote = internalNote?.trim() || undefined;
  if (cleanNote && cleanNote.length > 2_000) {
    throw new Error("Internal note is too long.");
  }

  return getDb().$transaction(
    async (tx) => {
      const payout = await tx.sellerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        include: {
          adjustments: {
            select: { adjustmentType: true, amount: true },
            orderBy: { createdAt: "asc" },
          },
          order: true,
        },
      });
      if (confirmation.trim() !== payout.payoutNumber && confirmation.trim() !== payout.order.orderNumber) {
        throw new Error("Type the payout number or order number to confirm this adjustment.");
      }
      if (payout.currency.toLowerCase() !== currency.trim().toLowerCase()) {
        throw new Error("Adjustment currency must match the payout currency.");
      }
      if (payout.status === SellerPayoutStatus.CANCELLED) {
        throw new Error("A cancelled payout cannot be adjusted.");
      }

      const sent = payout.status === SellerPayoutStatus.SENT;
      const entries: PayoutAdjustmentEntry[] = [
        ...payout.adjustments.map((entry) => ({
          adjustmentType: entry.adjustmentType as AdjustmentType,
          amount: entry.amount,
        })),
        { adjustmentType, amount },
      ];
      const totals = sent
        ? null
        : calculatePayoutAdjustmentTotals({
            sellerPayableAmount: payout.sellerPayableAmount,
            refundAdjustmentAmount: payout.refundAdjustmentAmount,
            adjustments: entries,
          });
      const adjustment = await tx.sellerPayoutAdjustment.create({
        data: {
          payoutId: payout.id,
          adjustmentType: adjustmentType as SellerPayoutAdjustmentType,
          amount,
          currency: payout.currency.toLowerCase(),
          reason: cleanReason,
          ...(cleanNote ? { internalNote: cleanNote } : {}),
          requiresManualReconciliation: sent,
          createdByUserId: actorUserId,
        },
      });

      if (sent) {
        // The historical transfer has occurred outside Trade82. Keep its
        // financial snapshot immutable and require an admin reconciliation.
        await tx.tradeOrder.update({
          where: { id: payout.orderId },
          data: { payoutStatus: OrderPayoutStatus.HOLD },
        });
        await tx.paymentRequest.update({
          where: { id: payout.order.paymentRequestId },
          data: {
            requiresManualReconciliation: true,
            reconciliationNote: "A post-sent seller payout adjustment requires manual reconciliation.",
          },
        });
        await appendTradeOrderEvent(tx, {
          orderId: payout.orderId,
          eventType: TradeOrderEventType.PAYOUT_HOLD,
          actorUserId,
          message: "Post-sent payout adjustment recorded; manual reconciliation is required.",
          metadata: { adjustmentId: adjustment.id, adjustmentType, amount, currency: payout.currency.toLowerCase() },
        });
      } else {
        const updated = await tx.sellerPayout.updateMany({
          where: {
            id: payout.id,
            status: { in: ["READY", "HOLD", "PROCESSING", "FAILED"] },
            sentAt: null,
          },
          data: {
            manualAdjustmentAmount: totals!.manualAdjustmentAmount,
            finalPayoutAmount: totals!.finalPayoutAmount,
          },
        });
        if (!updated.count) throw new Error("Payout state changed. Refresh and try again.");
      }

      await addPayoutEvent(
        tx,
        payout.id,
        SellerPayoutEventType.ADJUSTMENT_ADDED,
        actorUserId,
        sent
          ? "Post-sent payout adjustment recorded; manual reconciliation is required."
          : "Manual payout adjustment recorded.",
        {
          adjustmentId: adjustment.id,
          adjustmentType,
          amount,
          currency: payout.currency.toLowerCase(),
          requiresManualReconciliation: sent,
        },
      );
      if (!sent) {
        await appendTradeOrderEvent(tx, {
          orderId: payout.orderId,
          eventType: TradeOrderEventType.ADMIN_NOTE,
          actorUserId,
          message: "Manual payout adjustment recorded.",
          metadata: { adjustmentId: adjustment.id, adjustmentType, amount, currency: payout.currency.toLowerCase() },
        });
      }

      return {
        adjustment,
        reconciliationRequired: sent,
        ...(totals
          ? {
              manualAdjustmentAmount: totals.manualAdjustmentAmount,
              finalPayoutAmount: totals.finalPayoutAmount,
            }
          : {}),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
