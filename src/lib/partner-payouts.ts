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

const ACCOUNTING_REVERSAL_STATUSES = new Set([
  "ACCOUNTING_APPLIED",
  "PENDING",
  "COMPLETED",
  "NEEDS_MANUAL_REVIEW",
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
  idempotencyKey,
}: {
  tx: Tx;
  payoutId: string;
  eventType: PartnerPayoutEventType;
  actorUserId?: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
}) {
  if (idempotencyKey) {
    const existing = await tx.partnerPayoutEvent.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existing) return existing;
  }
  try {
    return await tx.partnerPayoutEvent.create({
      data: {
        payoutId,
        eventType,
        ...(actorUserId ? { actorUserId } : {}),
        ...(message ? { message } : {}),
        ...(metadata ? { metadata } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });
  } catch (error) {
    if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return tx.partnerPayoutEvent.findUniqueOrThrow({
        where: { idempotencyKey },
      });
    }
    throw error;
  }
}

async function lockPartnerPayoutRows(
  tx: Tx,
  ids: {
    partnerPayoutId?: string | null;
    settlementId: string;
    settlementLegId: string;
    partnerProfileId: string;
    payoutProfileId?: string | null;
  },
) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Settlement" WHERE "id" = ${ids.settlementId} FOR UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SettlementLeg" WHERE "id" = ${ids.settlementLegId} FOR UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PartnerProfile" WHERE "id" = ${ids.partnerProfileId} FOR UPDATE`);
  if (ids.payoutProfileId) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PartnerPayoutProfile" WHERE "id" = ${ids.payoutProfileId} FOR UPDATE`);
  }
  if (ids.partnerPayoutId) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PartnerPayout" WHERE "id" = ${ids.partnerPayoutId} FOR UPDATE`);
  }
}

async function loadPartnerPayoutLeg(tx: Tx, settlementLegId: string) {
  return tx.settlementLeg.findUniqueOrThrow({
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
            select: { amount: true, requestedAmount: true, successfullyReversedAmount: true, status: true },
          },
        },
      },
    },
  });
}

function accountingReversalAmount(reversal: {
  amount: number;
  requestedAmount: number | null;
  successfullyReversedAmount: number;
  status: string;
}) {
  if (!ACCOUNTING_REVERSAL_STATUSES.has(reversal.status)) return 0;
  if (reversal.status === "COMPLETED") return Math.max(0, reversal.successfullyReversedAmount);
  return Math.max(0, reversal.requestedAmount ?? reversal.amount);
}

function snapshotData(profile: NonNullable<Awaited<ReturnType<typeof loadPartnerPayoutLeg>>["partnerProfile"]>["payoutProfile"], partner: NonNullable<Awaited<ReturnType<typeof loadPartnerPayoutLeg>>["partnerProfile"]>) {
  if (!profile) return {};
  const encrypted = encryptedSnapshot(profile);
  return {
    accountCountrySnapshot: profile.country,
    accountTypeSnapshot: profile.accountType,
    payoutCurrencySnapshot: profile.payoutCurrency,
    supportedCurrenciesSnapshot: profile.supportedCurrencies,
    bankNameSnapshot: profile.bankName,
    accountHolderSnapshot: profile.accountHolder,
    accountNumberSnapshotEncrypted: prismaBytes(encrypted.ciphertext),
    accountNumberSnapshotIv: prismaBytes(encrypted.iv),
    accountNumberSnapshotAuthTag: prismaBytes(encrypted.authTag),
    accountNumberSnapshotKeyVersion: encrypted.keyVersion,
    accountNumberLast4: profile.accountNumberLast4,
    accountNumberMasked: profile.accountNumberMasked,
    partnerLegalNameSnapshot: partner.legalName,
    partnerDisplayNameSnapshot: partner.displayName ?? partner.user.displayName,
    partnerOrganizationSnapshot: partner.organizationName,
    partnerEmailSnapshot: partner.contactEmail ?? partner.user.email,
    partnerPhoneSnapshot: partner.contactPhone ?? partner.user.phoneNumber ?? null,
    partnerResidenceCountrySnapshot: partner.country ?? partner.user.country ?? null,
  } satisfies Prisma.PartnerPayoutUncheckedUpdateInput;
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

export function partnerPayoutStatusForLeg({
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

async function reconcilePartnerPayoutForSettlementLegInTransaction({
  tx,
  settlementLegId,
  actorUserId,
}: {
  tx: Tx;
  settlementLegId: string;
  actorUserId?: string;
}) {
      const initial = await loadPartnerPayoutLeg(tx, settlementLegId);
      if (!initial.partnerProfileId || !initial.partnerProfile) {
        throw new Error("Partner payout requires a partner referral settlement leg.");
      }
      await lockPartnerPayoutRows(tx, {
        partnerPayoutId: initial.partnerPayout?.id,
        settlementId: initial.settlementId,
        settlementLegId: initial.id,
        partnerProfileId: initial.partnerProfileId,
        payoutProfileId: initial.partnerProfile.payoutProfile?.id,
      });
      const leg = await loadPartnerPayoutLeg(tx, settlementLegId);
      if (leg.type !== SettlementLegType.PARTNER_REFERRAL || !leg.partnerProfileId || !leg.partnerProfile) {
        throw new Error("Partner payout requires a partner referral settlement leg.");
      }
      if (leg.settlement.paymentFlow === "DIRECT_CHARGE") {
        throw new Error("Direct Charge orders are not eligible for legacy SCT partner payouts.");
      }

      const reversalAdjustmentAmount = leg.settlement.reversals.reduce(
        (total, reversal) => total + accountingReversalAmount(reversal),
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

      const requiresManualReconciliation =
        leg.settlement.paymentRequest.requiresManualReconciliation ||
        leg.settlement.reversals.some((reversal) => ACCOUNTING_REVERSAL_STATUSES.has(reversal.status)) ||
        leg.settlement.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status));
      const capturesSnapshot =
        !leg.partnerPayout?.snapshotCapturedAt &&
        profile?.status === PartnerPayoutProfileStatus.VERIFIED &&
        nextStatus === PartnerPayoutStatus.READY;
      const captured = capturesSnapshot ? snapshotData(profile, leg.partnerProfile) : {};
      const baseData = {
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
        requiresManualReconciliation,
        ...captured,
        ...(capturesSnapshot ? { snapshotCapturedAt: now } : {}),
      } satisfies Prisma.PartnerPayoutUncheckedUpdateInput;

      if (leg.partnerPayout) {
        const payout = await tx.partnerPayout.update({
          where: { id: leg.partnerPayout.id },
          data: {
            ...(leg.partnerPayout.snapshotCapturedAt
              ? {
                  status: PartnerPayoutStatus.SENT === leg.partnerPayout.status
                    ? PartnerPayoutStatus.SENT
                    : nextStatus,
                  requiresManualReconciliation,
                }
              : {
                  ...baseData,
                  payoutProfileId: leg.partnerPayout.payoutProfileId ?? profile?.id ?? null,
                  status: leg.partnerPayout.status === PartnerPayoutStatus.SENT
                    ? PartnerPayoutStatus.SENT
                    : nextStatus,
                }),
          },
        });
        if (payout.status !== leg.partnerPayout.status) {
          const eventType = payout.status === PartnerPayoutStatus.READY
            ? PartnerPayoutEventType.READY
            : payout.status === PartnerPayoutStatus.HOLD
              ? PartnerPayoutEventType.HOLD
              : payout.status === PartnerPayoutStatus.CANCELLED
                ? PartnerPayoutEventType.CANCELLED
                : null;
          if (eventType) {
            await addPartnerPayoutEvent({
              tx,
              payoutId: payout.id,
              eventType,
              actorUserId,
              message: `Partner payout status changed to ${payout.status.toLowerCase()}.`,
              idempotencyKey: `partner-payout:${payout.id}:transition:${leg.partnerPayout.updatedAt.toISOString()}:${payout.status}`,
            });
          }
        }
        if (payout.status === PartnerPayoutStatus.SENT && requiresManualReconciliation) {
          await addPartnerPayoutEvent({
            tx,
            payoutId: payout.id,
            eventType: PartnerPayoutEventType.RECONCILIATION_REQUIRED,
            actorUserId,
            message: "A sent partner payout requires reconciliation.",
            idempotencyKey: `partner-payout:${payout.id}:reconciliation-required`,
          });
        }
        return payout;
      }

      const payout = await tx.partnerPayout.create({
        data: {
          ...baseData,
          payoutProfileId: profile?.id ?? null,
          preparedAt: now,
          preparedByUserId: actorUserId ?? null,
          payoutNumber: payoutNumberForSettlementLeg(leg.id),
        },
      });
      await addPartnerPayoutEvent({
        tx,
        payoutId: payout.id,
        eventType: PartnerPayoutEventType.CREATED,
        actorUserId,
        message: "Partner payout review record created.",
        idempotencyKey: `partner-payout:${payout.id}:created`,
      });
      if (nextStatus === PartnerPayoutStatus.READY) {
        await addPartnerPayoutEvent({
          tx,
          payoutId: payout.id,
          eventType: PartnerPayoutEventType.READY,
          actorUserId,
          message: "Partner payout is ready for manual bank processing.",
          idempotencyKey: `partner-payout:${payout.id}:ready`,
        });
      }
      return payout;
}

export async function reconcilePartnerPayoutForSettlementLeg({
  tx,
  settlementLegId,
  actorUserId,
}: {
  tx: Tx;
  settlementLegId: string;
  actorUserId?: string;
}) {
  return reconcilePartnerPayoutForSettlementLegInTransaction({ tx, settlementLegId, actorUserId });
}

export async function preparePartnerPayoutForSettlementLeg({
  settlementLegId,
  actorUserId,
}: {
  settlementLegId: string;
  actorUserId?: string;
}) {
  return getDb().$transaction(
    (tx) => reconcilePartnerPayoutForSettlementLegInTransaction({ tx, settlementLegId, actorUserId }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function markPartnerPayoutSent({
  payoutId,
  actorUserId,
  externalTransferReference,
  confirmation,
  externalBankReference,
}: {
  payoutId: string;
  actorUserId: string;
  externalTransferReference: string;
  confirmation: string;
  externalBankReference?: string;
}) {
  const cleanReference = requiredText(externalTransferReference, "External transfer reference", 240);
  return getDb().$transaction(
    async (tx) => {
      const existing = await tx.partnerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        select: {
          id: true,
          settlementId: true,
          settlementLegId: true,
          partnerProfileId: true,
          payoutProfileId: true,
          status: true,
        },
      });
      const initialLeg = await loadPartnerPayoutLeg(tx, existing.settlementLegId);
      if (!initialLeg.partnerProfileId || !initialLeg.partnerProfile) throw new Error("Partner payout is unavailable.");
      await lockPartnerPayoutRows(tx, {
        partnerPayoutId: payoutId,
        settlementId: existing.settlementId,
        settlementLegId: existing.settlementLegId,
        partnerProfileId: existing.partnerProfileId,
        payoutProfileId: existing.payoutProfileId,
      });
      const leg = await loadPartnerPayoutLeg(tx, existing.settlementLegId);
      const payout = leg.partnerPayout;
      if (!payout) throw new Error("Partner payout is unavailable.");
      if (payout.status === PartnerPayoutStatus.SENT) return { alreadySent: true };
      assertPartnerPayoutEligibleForProcessing(payout, leg);
      if (confirmation.trim() !== payout.payoutNumber && confirmation.trim() !== leg.settlement.tradeOrder.orderNumber) {
        throw new Error("Type the payout number or order number to confirm the external partner payout.");
      }
      const sentAt = new Date();
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
        idempotencyKey: `partner-payout:${payout.id}:sent:${payout.updatedAt.toISOString()}`,
      });
      return { alreadySent: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function assertPartnerPayoutEligibleForProcessing(
  payout: NonNullable<Awaited<ReturnType<typeof loadPartnerPayoutLeg>>["partnerPayout"]>,
  leg: Awaited<ReturnType<typeof loadPartnerPayoutLeg>>,
) {
  if (leg.type !== SettlementLegType.PARTNER_REFERRAL || leg.settlement.paymentFlow === "DIRECT_CHARGE") {
    throw new Error("Partner payout is not eligible for legacy SCT processing.");
  }
  if (payout.status !== PartnerPayoutStatus.READY && payout.status !== PartnerPayoutStatus.PROCESSING) {
    throw new Error("Partner payout state changed. Refresh and try again.");
  }
  if (!payout.snapshotCapturedAt || payout.finalPayoutAmount <= 0) {
    throw new Error("Partner payout instructions are not ready for processing.");
  }
  if (
    leg.partnerProfile?.status !== PartnerProfileStatus.ACTIVE ||
    leg.partnerProfile.payoutProfile?.status !== PartnerPayoutProfileStatus.VERIFIED ||
    leg.settlement.paymentRequest.status !== "PAID" ||
    leg.settlement.paymentRequest.requiresManualReconciliation ||
    leg.manualReviewRequired ||
    leg.settlement.status === "HOLD" ||
    leg.settlement.status === "CANCELLED" ||
    leg.status === "HOLD" ||
    leg.status === "CANCELLED" ||
    leg.holdUntil > new Date() ||
    leg.settlement.paymentRequest.disputes.some((item) => ACTIVE_DISPUTE_STATUSES.has(item.status))
  ) {
    throw new Error("Partner payout is no longer eligible for processing.");
  }
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
      const existing = await tx.partnerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        select: {
          id: true,
          settlementId: true,
          settlementLegId: true,
          partnerProfileId: true,
          payoutProfileId: true,
          status: true,
          updatedAt: true,
        },
      });
      const initialLeg = await loadPartnerPayoutLeg(tx, existing.settlementLegId);
      if (!initialLeg.partnerProfileId || !initialLeg.partnerProfile) throw new Error("Partner payout is unavailable.");
      await lockPartnerPayoutRows(tx, {
        partnerPayoutId: payoutId,
        settlementId: existing.settlementId,
        settlementLegId: existing.settlementLegId,
        partnerProfileId: existing.partnerProfileId,
        payoutProfileId: existing.payoutProfileId,
      });
      const leg = await loadPartnerPayoutLeg(tx, existing.settlementLegId);
      const payout = leg.partnerPayout;
      if (!payout) throw new Error("Partner payout is unavailable.");
      if (payout.status === PartnerPayoutStatus.SENT) throw new Error("Sent partner payouts cannot be changed.");
      if (status === "PROCESSING") assertPartnerPayoutEligibleForProcessing(payout, leg);
      if (
        payout.status === PartnerPayoutStatus.CANCELLED ||
        payout.status === PartnerPayoutStatus.NOT_READY
      ) {
        throw new Error("Partner payout state changed. Refresh and try again.");
      }
      const changed = await tx.partnerPayout.updateMany({
        where: { id: payoutId, status: payout.status },
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
        idempotencyKey: `partner-payout:${payoutId}:transition:${payout.updatedAt.toISOString()}:${status}`,
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
