import "server-only";

import {
  PartnerPayoutEventType,
  PartnerPayoutProfileStatus,
  PartnerPayoutStatus,
  PartnerProfileStatus,
  Prisma,
  SettlementLegType,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { decryptPayoutData, encryptPayoutData } from "@/lib/payout-crypto";

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

function payoutNumberForSettlementLeg(settlementLegId: string) {
  return `PP-${settlementLegId.replace(/[^a-z0-9]/gi, "").slice(-12).toUpperCase()}`;
}

function requiredText(value: string, field: string, max = 500) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  if (trimmed.length > max) throw new Error(`${field} is too long.`);
  return trimmed;
}

function sanitizedReason(value: string | undefined) {
  const reason = value?.trim();
  return reason ? reason.slice(0, 1_000) : undefined;
}

async function addPartnerPayoutEvent({
  tx,
  payoutId,
  eventType,
  actorUserId,
  message,
  metadata,
}: {
  tx: Tx;
  payoutId: string;
  eventType: PartnerPayoutEventType;
  actorUserId?: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await tx.partnerPayoutEvent.create({
    data: {
      payoutId,
      eventType,
      ...(actorUserId ? { actorUserId } : {}),
      ...(message ? { message } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
}

function encryptedSnapshot(profile: {
  accountNumberCiphertext: Uint8Array;
  accountNumberIv: Uint8Array;
  accountNumberAuthTag: Uint8Array;
  accountNumberKeyVersion: string;
}) {
  const accountNumber = decryptPayoutData({
    ciphertext: Buffer.from(profile.accountNumberCiphertext),
    iv: Buffer.from(profile.accountNumberIv),
    authTag: Buffer.from(profile.accountNumberAuthTag),
    keyVersion: profile.accountNumberKeyVersion,
  });
  return encryptPayoutData(accountNumber);
}

function partnerPayoutStatusForLeg({
  now,
  leg,
  settlement,
  payoutProfileStatus,
  partnerStatus,
  finalPayoutAmount,
}: {
  now: Date;
  leg: { holdUntil: Date; status: string; manualReviewRequired: boolean };
  settlement: {
    status: string;
    approvedAt: Date | null;
    paymentRequest: {
      status: string;
      requiresManualReconciliation: boolean;
      refundAmount: number;
      disputes: Array<{ status: string }>;
    };
  };
  payoutProfileStatus: PartnerPayoutProfileStatus | null;
  partnerStatus: PartnerProfileStatus;
  finalPayoutAmount: number;
}) {
  if (finalPayoutAmount <= 0 || settlement.status === "CANCELLED" || leg.status === "CANCELLED") {
    return PartnerPayoutStatus.CANCELLED;
  }
  if (
    partnerStatus !== PartnerProfileStatus.ACTIVE ||
    payoutProfileStatus !== PartnerPayoutProfileStatus.VERIFIED
  ) {
    return PartnerPayoutStatus.NOT_READY;
  }
  if (
    settlement.paymentRequest.status !== "PAID" ||
    settlement.paymentRequest.requiresManualReconciliation ||
    settlement.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status)) ||
    leg.manualReviewRequired
  ) {
    return PartnerPayoutStatus.HOLD;
  }
  if (!settlement.approvedAt || settlement.status === "HOLD" || leg.holdUntil > now || leg.status === "HOLD") {
    return PartnerPayoutStatus.HOLD;
  }
  return PartnerPayoutStatus.READY;
}

export async function preparePartnerPayoutForSettlementLeg({
  settlementLegId,
  actorUserId,
}: {
  settlementLegId: string;
  actorUserId?: string;
}) {
  return getDb().$transaction(
    async (tx) => {
      const leg = await tx.settlementLeg.findUniqueOrThrow({
        where: { id: settlementLegId },
        include: {
          partnerPayout: true,
          partnerProfile: {
            include: {
              payoutProfile: true,
              user: { select: { email: true, phoneNumber: true, country: true, displayName: true } },
            },
          },
          settlement: {
            include: {
              tradeOrder: true,
              paymentRequest: { include: { disputes: { select: { status: true } } } },
              reversals: {
                where: { settlementLegId },
                select: { amount: true, status: true },
              },
            },
          },
        },
      });
      if (leg.type !== SettlementLegType.PARTNER_REFERRAL || !leg.partnerProfileId || !leg.partnerProfile) {
        throw new Error("Partner payout requires a partner referral settlement leg.");
      }
      if (leg.settlement.paymentFlow === "DIRECT_CHARGE") {
        throw new Error("Direct Charge orders are not eligible for legacy SCT partner payouts.");
      }

      const reversalAdjustmentAmount = leg.settlement.reversals.reduce(
        (total, reversal) => total + Math.max(0, reversal.amount),
        0,
      );
      const finalPayoutAmount = Math.max(0, leg.amount - reversalAdjustmentAmount);
      const profile = leg.partnerProfile.payoutProfile;
      const now = new Date();
      const nextStatus = partnerPayoutStatusForLeg({
        now,
        leg,
        settlement: leg.settlement,
        payoutProfileStatus: profile?.status ?? null,
        partnerStatus: leg.partnerProfile.status,
        finalPayoutAmount,
      });

      const encrypted = profile ? encryptedSnapshot(profile) : null;
      const data = {
        settlementId: leg.settlementId,
        settlementLegId: leg.id,
        orderId: leg.settlement.tradeOrderId,
        partnerProfileId: leg.partnerProfileId,
        payoutProfileId: profile?.id ?? null,
        status: nextStatus,
        currency: leg.currency,
        originalCommissionAmount: leg.amount,
        reversalAdjustmentAmount,
        finalPayoutAmount,
        holdUntil: leg.holdUntil,
        accountCountrySnapshot: profile?.country ?? null,
        accountTypeSnapshot: profile?.accountType ?? null,
        payoutCurrencySnapshot: profile?.payoutCurrency ?? null,
        supportedCurrenciesSnapshot: profile?.supportedCurrencies ?? [],
        bankNameSnapshot: profile?.bankName ?? null,
        accountHolderSnapshot: profile?.accountHolder ?? null,
        accountNumberSnapshotEncrypted: encrypted ? prismaBytes(encrypted.ciphertext) : null,
        accountNumberSnapshotIv: encrypted ? prismaBytes(encrypted.iv) : null,
        accountNumberSnapshotAuthTag: encrypted ? prismaBytes(encrypted.authTag) : null,
        accountNumberSnapshotKeyVersion: encrypted?.keyVersion ?? null,
        accountNumberLast4: profile?.accountNumberLast4 ?? null,
        accountNumberMasked: profile?.accountNumberMasked ?? null,
        partnerLegalNameSnapshot: leg.partnerProfile.legalName ?? null,
        partnerDisplayNameSnapshot: leg.partnerProfile.displayName ?? leg.partnerProfile.user.displayName,
        partnerOrganizationSnapshot: leg.partnerProfile.organizationName ?? null,
        partnerEmailSnapshot: leg.partnerProfile.contactEmail ?? leg.partnerProfile.user.email,
        partnerPhoneSnapshot: leg.partnerProfile.contactPhone ?? leg.partnerProfile.user.phoneNumber ?? null,
        partnerResidenceCountrySnapshot: leg.partnerProfile.country ?? leg.partnerProfile.user.country ?? null,
        preparedAt: now,
        preparedByUserId: actorUserId ?? null,
        requiresManualReconciliation:
          leg.settlement.paymentRequest.requiresManualReconciliation ||
          leg.settlement.reversals.length > 0 ||
          leg.settlement.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status)),
      } satisfies Prisma.PartnerPayoutUncheckedUpdateInput;

      if (leg.partnerPayout) {
        const payout = await tx.partnerPayout.update({
          where: { id: leg.partnerPayout.id },
          data: {
            ...data,
            status: leg.partnerPayout.status === PartnerPayoutStatus.SENT ? PartnerPayoutStatus.SENT : nextStatus,
          },
        });
        return payout;
      }

      const payout = await tx.partnerPayout.create({
        data: {
          ...data,
          payoutNumber: payoutNumberForSettlementLeg(leg.id),
        },
      });
      await addPartnerPayoutEvent({
        tx,
        payoutId: payout.id,
        eventType: PartnerPayoutEventType.CREATED,
        actorUserId,
        message: "Partner payout review record created.",
      });
      if (nextStatus === PartnerPayoutStatus.READY) {
        await addPartnerPayoutEvent({
          tx,
          payoutId: payout.id,
          eventType: PartnerPayoutEventType.READY,
          actorUserId,
          message: "Partner payout is ready for manual bank processing.",
        });
      }
      return payout;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function markPartnerPayoutSent({
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
  const cleanReference = requiredText(externalTransferReference, "External transfer reference", 240);
  return getDb().$transaction(
    async (tx) => {
      const payout = await tx.partnerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        include: { order: { select: { orderNumber: true } } },
      });
      if (payout.status === PartnerPayoutStatus.SENT) return { alreadySent: true };
      if (confirmation.trim() !== payout.payoutNumber && confirmation.trim() !== payout.order.orderNumber) {
        throw new Error("Type the payout number or order number to confirm the external partner payout.");
      }
      const changed = await tx.partnerPayout.updateMany({
        where: { id: payout.id, status: { in: ["READY", "PROCESSING"] }, sentAt: null },
        data: {
          status: PartnerPayoutStatus.SENT,
          sentAt,
          sentByUserId: actorUserId,
          externalTransferReference: cleanReference,
          externalBankReference: externalBankReference?.trim() || null,
        },
      });
      if (!changed.count) throw new Error("Partner payout state changed. Refresh and try again.");
      await addPartnerPayoutEvent({
        tx,
        payoutId,
        eventType: PartnerPayoutEventType.SENT,
        actorUserId,
        message: "External partner payout recorded as sent.",
      });
      return { alreadySent: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setPartnerPayoutStatus({
  payoutId,
  actorUserId,
  status,
  failureReason,
}: {
  payoutId: string;
  actorUserId: string;
  status: "HOLD" | "PROCESSING" | "FAILED" | "RETURNED";
  failureReason?: string;
}) {
  return getDb().$transaction(
    async (tx) => {
      const changed = await tx.partnerPayout.updateMany({
        where: { id: payoutId, status: { in: ["READY", "HOLD", "PROCESSING", "FAILED", "RETURNED"] } },
        data: {
          status: status as PartnerPayoutStatus,
          ...(status === "FAILED" || status === "RETURNED"
            ? {
                failedAt: new Date(),
                failureReason: sanitizedReason(failureReason) ?? "Partner payout needs review.",
                requiresManualReconciliation: true,
              }
            : {}),
        },
      });
      if (!changed.count) throw new Error("Partner payout state changed. Refresh and try again.");
      await addPartnerPayoutEvent({
        tx,
        payoutId,
        eventType: status as PartnerPayoutEventType,
        actorUserId,
        message: `Partner payout marked ${status.toLowerCase()}.`,
      });
      return { ok: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function revealPartnerPayoutInstructions({
  payoutId,
  actorUserId,
  reason,
}: {
  payoutId: string;
  actorUserId: string;
  reason: string;
}) {
  const cleanReason = requiredText(reason, "Reason", 500);
  return getDb().$transaction(async (tx) => {
    const payout = await tx.partnerPayout.findUniqueOrThrow({
      where: { id: payoutId },
      select: {
        id: true,
        payoutNumber: true,
        bankNameSnapshot: true,
        accountHolderSnapshot: true,
        accountCountrySnapshot: true,
        accountTypeSnapshot: true,
        payoutCurrencySnapshot: true,
        partnerLegalNameSnapshot: true,
        partnerDisplayNameSnapshot: true,
        partnerEmailSnapshot: true,
        partnerPhoneSnapshot: true,
        accountNumberSnapshotEncrypted: true,
        accountNumberSnapshotIv: true,
        accountNumberSnapshotAuthTag: true,
        accountNumberSnapshotKeyVersion: true,
      },
    });
    if (
      !payout.accountNumberSnapshotEncrypted ||
      !payout.accountNumberSnapshotIv ||
      !payout.accountNumberSnapshotAuthTag ||
      !payout.accountNumberSnapshotKeyVersion
    ) {
      throw new Error("Partner payout bank instructions are not available.");
    }
    const accountNumber = decryptPayoutData({
      ciphertext: Buffer.from(payout.accountNumberSnapshotEncrypted),
      iv: Buffer.from(payout.accountNumberSnapshotIv),
      authTag: Buffer.from(payout.accountNumberSnapshotAuthTag),
      keyVersion: payout.accountNumberSnapshotKeyVersion,
    });
    await addPartnerPayoutEvent({
      tx,
      payoutId,
      eventType: PartnerPayoutEventType.ACCOUNT_REVEALED,
      actorUserId,
      message: "Admin revealed partner bank instructions.",
      metadata: { reason: cleanReason },
    });
    return {
      payoutNumber: payout.payoutNumber,
      country: payout.accountCountrySnapshot,
      bankName: payout.bankNameSnapshot,
      accountHolder: payout.accountHolderSnapshot,
      accountNumber,
      accountType: payout.accountTypeSnapshot,
      payoutCurrency: payout.payoutCurrencySnapshot,
      partnerName: payout.partnerLegalNameSnapshot ?? payout.partnerDisplayNameSnapshot,
      partnerEmail: payout.partnerEmailSnapshot,
      partnerPhone: payout.partnerPhoneSnapshot,
    };
  });
}

export async function ensurePartnerPayoutsForAdminReview(actorUserId: string) {
  const legs = await getDb().settlementLeg.findMany({
    where: {
      type: SettlementLegType.PARTNER_REFERRAL,
      settlement: {
        paymentFlow: "SCT",
      },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  for (const leg of legs) {
    try {
      await preparePartnerPayoutForSettlementLeg({ settlementLegId: leg.id, actorUserId });
    } catch (error) {
      console.error("Partner payout preparation skipped.", {
        settlementLegId: leg.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
