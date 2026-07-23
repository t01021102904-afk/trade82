import "server-only";

import { Prisma, PartnerPayoutProfileStatus } from "@/generated/prisma/client";
import {
  decryptPayoutData,
  encryptPayoutData,
  lastFour,
  maskAccountNumber,
} from "@/lib/payout-crypto";
import {
  KOREAN_PAYOUT_ACCOUNT_TYPE,
  KOREAN_PAYOUT_COUNTRY,
  KOREAN_PAYOUT_CURRENCY,
  KOREAN_PAYOUT_SUPPORTED_CURRENCIES,
  normalizeKoreanAccountNumber,
} from "@/lib/seller-payout-profile-rules";

const partnerPayoutProfileOwnerFields = {
  id: true,
  bankName: true,
  accountHolder: true,
  accountNumberMasked: true,
  accountNumberLast4: true,
  payoutCurrency: true,
  status: true,
  verifiedAt: true,
  updatedAt: true,
} satisfies Prisma.PartnerPayoutProfileSelect;

export const partnerPayoutProfileOwnerSelect = {
  ...partnerPayoutProfileOwnerFields,
} satisfies Prisma.PartnerPayoutProfileSelect;

export const partnerPayoutProfileAdminSummarySelect = {
  ...partnerPayoutProfileOwnerFields,
} satisfies Prisma.PartnerPayoutProfileSelect;

export const partnerPayoutProfileInternalSelect = {
  id: true,
  partnerProfileId: true,
  bankDirectoryId: true,
  country: true,
  bankName: true,
  accountHolder: true,
  accountNumberCiphertext: true,
  accountNumberIv: true,
  accountNumberAuthTag: true,
  accountNumberKeyVersion: true,
  accountNumberLast4: true,
  accountNumberMasked: true,
  accountType: true,
  payoutCurrency: true,
  supportedCurrencies: true,
  accountBelongsToPartner: true,
  status: true,
  verifiedAt: true,
  verifiedByUserId: true,
  createdAt: true,
  updatedAt: true,
  bankDirectory: {
    select: {
      id: true,
      bankNameLocal: true,
      bankNameEnglish: true,
      bankCode: true,
      defaultSwiftBic: true,
      defaultBankAddress: true,
      verifiedAt: true,
    },
  },
} satisfies Prisma.PartnerPayoutProfileSelect;

export type PartnerPayoutProfileInput = {
  bankDirectoryId: string;
  accountHolder: string;
  accountNumber: string;
  accountBelongsToPartner: boolean;
};

type PartnerPayoutDb = Pick<
  Prisma.TransactionClient,
  "partnerPayoutProfile" | "bankDirectory" | "partnerPayoutProfileAuditEvent"
>;

function requiredText(value: string, field: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long.`);
  return trimmed;
}

function bytes(value: Uint8Array) {
  return Uint8Array.from(value);
}

export function assertPartnerPayoutConfiguration() {
  return {
    country: KOREAN_PAYOUT_COUNTRY,
    accountType: KOREAN_PAYOUT_ACCOUNT_TYPE,
    payoutCurrency: KOREAN_PAYOUT_CURRENCY,
    supportedCurrencies: [...KOREAN_PAYOUT_SUPPORTED_CURRENCIES],
  };
}

export async function savePartnerPayoutProfile({
  db,
  partnerProfileId,
  actorUserId,
  input,
}: {
  db: PartnerPayoutDb;
  partnerProfileId: string;
  actorUserId: string;
  input: PartnerPayoutProfileInput;
}) {
  if (!input.accountBelongsToPartner) {
    throw new Error("Confirm that the payout account belongs to the partner.");
  }

  const bankDirectoryId = requiredText(input.bankDirectoryId, "Bank", 128);
  const accountHolder = requiredText(input.accountHolder, "Account holder", 240);
  const accountNumber = normalizeKoreanAccountNumber(input.accountNumber);
  const bank = await db.bankDirectory.findFirst({
    where: {
      id: bankDirectoryId,
      countryCode: KOREAN_PAYOUT_COUNTRY,
      isActive: true,
    },
    select: { id: true, bankNameEnglish: true },
  });
  if (!bank) throw new Error("Selected Korean bank is not available.");

  const existing = await db.partnerPayoutProfile.findUnique({
    where: { partnerProfileId },
    select: { id: true, status: true },
  });
  const encrypted = encryptPayoutData(accountNumber);
  const configuration = assertPartnerPayoutConfiguration();
  const data = {
    bankDirectoryId: bank.id,
    country: configuration.country,
    bankName: bank.bankNameEnglish,
    accountHolder,
    accountNumberCiphertext: bytes(encrypted.ciphertext),
    accountNumberIv: bytes(encrypted.iv),
    accountNumberAuthTag: bytes(encrypted.authTag),
    accountNumberKeyVersion: encrypted.keyVersion,
    accountNumberLast4: lastFour(accountNumber),
    accountNumberMasked: maskAccountNumber(accountNumber) as string,
    accountType: configuration.accountType,
    payoutCurrency: configuration.payoutCurrency,
    supportedCurrencies: configuration.supportedCurrencies,
    accountBelongsToPartner: true,
    status: PartnerPayoutProfileStatus.PENDING_VERIFICATION,
    verifiedAt: null,
    verifiedByUserId: null,
  };
  const profile = await db.partnerPayoutProfile.upsert({
    where: { partnerProfileId },
    create: { partnerProfileId, ...data },
    update: data,
    select: partnerPayoutProfileOwnerSelect,
  });

  await db.partnerPayoutProfileAuditEvent.create({
    data: {
      payoutProfileId: profile.id,
      actorUserId,
      action: existing ? "UPDATED" : "CREATED",
      metadata: {
        bankDirectoryId: bank.id,
        country: configuration.country,
        accountNumberLast4: lastFour(accountNumber),
        status: profile.status,
      },
    },
  });
  return profile;
}

export async function setPartnerPayoutVerification({
  db,
  payoutProfileId,
  actorUserId,
  status,
  reason,
}: {
  db: Prisma.TransactionClient;
  payoutProfileId: string;
  actorUserId: string;
  status: Extract<PartnerPayoutProfileStatus, "VERIFIED" | "REJECTED" | "DISABLED">;
  reason?: string;
}) {
  const sanitizedReason = reason?.trim().slice(0, 500) || null;
  if ((status === PartnerPayoutProfileStatus.REJECTED || status === PartnerPayoutProfileStatus.DISABLED) && !sanitizedReason) {
    throw new Error("A reason is required.");
  }
  const profile = await db.partnerPayoutProfile.update({
    where: { id: payoutProfileId },
    data: {
      status,
      verifiedAt: status === PartnerPayoutProfileStatus.VERIFIED ? new Date() : null,
      verifiedByUserId: status === PartnerPayoutProfileStatus.VERIFIED ? actorUserId : null,
    },
    select: { id: true, partnerProfileId: true, status: true },
  });
  await db.partnerPayoutProfileAuditEvent.create({
    data: {
      payoutProfileId,
      actorUserId,
      action: `STATUS_${status}`,
      metadata: sanitizedReason ? { reason: sanitizedReason } : {},
    },
  });
  return profile;
}

export async function revealPartnerPayoutAccount({
  db,
  payoutProfileId,
  actorUserId,
  reason,
}: {
  db: Prisma.TransactionClient;
  payoutProfileId: string;
  actorUserId: string;
  reason: string;
}) {
  const sanitizedReason = requiredText(reason, "Reason", 500);
  const profile = await db.partnerPayoutProfile.findUniqueOrThrow({
    where: { id: payoutProfileId },
    select: {
      id: true,
      accountNumberCiphertext: true,
      accountNumberIv: true,
      accountNumberAuthTag: true,
      accountNumberKeyVersion: true,
    },
  });
  const accountNumber = decryptPayoutData({
    ciphertext: Buffer.from(profile.accountNumberCiphertext),
    iv: Buffer.from(profile.accountNumberIv),
    authTag: Buffer.from(profile.accountNumberAuthTag),
    keyVersion: profile.accountNumberKeyVersion,
  });
  await db.partnerPayoutProfileAuditEvent.create({
    data: {
      payoutProfileId,
      actorUserId,
      action: "ACCOUNT_REVEALED",
      metadata: { reason: sanitizedReason },
    },
  });
  return accountNumber;
}
