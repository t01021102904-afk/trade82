import "server-only";

import { Prisma, SellerPayoutProfileStatus } from "@/generated/prisma/client";
import {
  decryptPayoutData,
  encryptPayoutData,
  lastFour,
  maskAccountNumber,
  type EncryptedPayoutData,
} from "@/lib/payout-crypto";
import { verifiedBankAutofill } from "@/lib/bank-directory-security";

export const sellerPayoutProfileSafeSelect = {
  id: true,
  companyId: true,
  bankDirectoryId: true,
  country: true,
  bankName: true,
  branchName: true,
  accountHolder: true,
  accountNumberLast4: true,
  accountNumberMasked: true,
  accountType: true,
  bankCode: true,
  swiftBic: true,
  bankAddress: true,
  beneficiaryAddress: true,
  payoutCurrency: true,
  supportedCurrencies: true,
  intermediaryBankName: true,
  intermediaryBankSwift: true,
  intermediaryBankAddress: true,
  payoutMemo: true,
  accountBelongsToCompany: true,
  manualBankOverride: true,
  manualOverrideReason: true,
  status: true,
  verifiedAt: true,
  updatedAt: true,
  bankDirectory: {
    select: {
      id: true,
      bankNameLocal: true,
      bankNameEnglish: true,
      defaultSwiftBic: true,
      defaultBankAddress: true,
      officialWebsite: true,
      verifiedAt: true,
    },
  },
} satisfies Prisma.SellerPayoutProfileSelect;

export type SellerPayoutProfileInput = {
  country: string;
  bankDirectoryId?: string | null;
  bankName: string;
  branchName?: string | null;
  accountHolder: string;
  accountNumber?: string | null;
  accountType: "LOCAL" | "FOREIGN_CURRENCY" | "IBAN" | "OTHER";
  bankCode?: string | null;
  swiftBic?: string | null;
  bankAddress?: string | null;
  beneficiaryAddress?: string | null;
  payoutCurrency: string;
  supportedCurrencies: string[];
  intermediaryBankName?: string | null;
  intermediaryBankSwift?: string | null;
  intermediaryBankAddress?: string | null;
  payoutMemo?: string | null;
  accountBelongsToCompany: boolean;
  manualBankOverride: boolean;
  manualOverrideReason?: string | null;
};

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function requiredText(value: string, field: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long.`);
  return trimmed;
}

function normalizedCurrency(value: string) {
  const currency = value.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Payout currency must be a three-letter code.");
  return currency;
}

function normalizedCountry(value: string) {
  const country = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("Payout country must be a two-letter ISO country code.");
  }
  return country;
}

function encryptedAccountData(accountNumber: string): EncryptedPayoutData {
  const value = accountNumber.replace(/\s+/g, "");
  if (
    value.length < 4 ||
    value.length > 64 ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
  ) {
    throw new Error("Account number is invalid.");
  }
  return encryptPayoutData(value);
}

function prismaBytes(value: Uint8Array) {
  return Uint8Array.from(value);
}

export async function saveSellerPayoutProfile({
  db,
  companyId,
  input,
}: {
  db: Pick<Prisma.TransactionClient, "sellerPayoutProfile" | "bankDirectory">;
  companyId: string;
  input: SellerPayoutProfileInput;
}) {
  if (![
    "LOCAL",
    "FOREIGN_CURRENCY",
    "IBAN",
    "OTHER",
  ].includes(input.accountType)) {
    throw new Error("Account type is invalid.");
  }
  if (!input.accountBelongsToCompany) {
    throw new Error("Confirm that the payout account belongs to the seller company or authorized beneficiary.");
  }
  if (input.manualBankOverride && !nullable(input.manualOverrideReason)) {
    throw new Error("A reason is required for a manual bank override.");
  }

  const existing = await db.sellerPayoutProfile.findUnique({
    where: { companyId },
    select: {
      id: true,
      accountNumberCiphertext: true,
      accountNumberIv: true,
      accountNumberAuthTag: true,
      accountNumberKeyVersion: true,
      status: true,
    },
  });

  const accountNumber = nullable(input.accountNumber);
  if (!existing && !accountNumber) {
    throw new Error("Account number or IBAN is required for a new payout profile.");
  }

  let encrypted: EncryptedPayoutData | null = null;
  if (accountNumber) encrypted = encryptedAccountData(accountNumber);

  let directory: {
    id: string;
    bankNameEnglish: string;
    defaultSwiftBic: string | null;
    defaultBankAddress: string | null;
    officialWebsite: string | null;
    verifiedAt: Date | null;
  } | null = null;
  if (input.bankDirectoryId) {
    directory = await db.bankDirectory.findFirst({
      where: { id: input.bankDirectoryId, isActive: true },
      select: { id: true, bankNameEnglish: true, defaultSwiftBic: true, defaultBankAddress: true, officialWebsite: true, verifiedAt: true },
    });
    if (!directory) throw new Error("Selected bank is not available.");
  }

  const sensitiveOrBankDetailsChanged = Boolean(
    accountNumber ||
      existing?.status === SellerPayoutProfileStatus.VERIFIED ||
      input.manualBankOverride,
  );
  const status = existing
    ? sensitiveOrBankDetailsChanged
      ? SellerPayoutProfileStatus.PENDING_VERIFICATION
      : existing.status
    : SellerPayoutProfileStatus.PENDING_VERIFICATION;
  // A selected bank name can be retained for review, but remittance fields from an
  // unverified directory entry are never auto-trusted or copied into a profile.
  const directoryDefaults = verifiedBankAutofill(directory, input.manualBankOverride);

  const payoutCurrency = normalizedCurrency(input.payoutCurrency);
  const data = {
    country: normalizedCountry(input.country),
    bankDirectoryId: directory?.id ?? null,
    bankName: directoryDefaults
      ? directoryDefaults.bankName
      : requiredText(input.bankName, "Bank name", 240),
    branchName: nullable(input.branchName),
    accountHolder: requiredText(input.accountHolder, "Account holder", 240),
    accountType: input.accountType,
    bankCode: nullable(input.bankCode),
    swiftBic: directoryDefaults ? directoryDefaults.swiftBic : nullable(input.swiftBic),
    bankAddress: directoryDefaults ? directoryDefaults.bankAddress : nullable(input.bankAddress),
    beneficiaryAddress: nullable(input.beneficiaryAddress),
    payoutCurrency,
    supportedCurrencies: Array.from(
      new Set([...input.supportedCurrencies, payoutCurrency].map(normalizedCurrency)),
    ).slice(0, 12),
    intermediaryBankName: nullable(input.intermediaryBankName),
    intermediaryBankSwift: nullable(input.intermediaryBankSwift),
    intermediaryBankAddress: nullable(input.intermediaryBankAddress),
    payoutMemo: nullable(input.payoutMemo),
    accountBelongsToCompany: true,
    manualBankOverride: input.manualBankOverride,
    manualOverrideReason: nullable(input.manualOverrideReason),
    status,
    verifiedAt: null,
    verifiedByUserId: null,
    ...(encrypted
      ? {
          accountNumberCiphertext: prismaBytes(encrypted.ciphertext),
          accountNumberIv: prismaBytes(encrypted.iv),
          accountNumberAuthTag: prismaBytes(encrypted.authTag),
          accountNumberKeyVersion: encrypted.keyVersion,
          accountNumberLast4: lastFour(accountNumber as string),
          accountNumberMasked: maskAccountNumber(accountNumber as string),
        }
      : {}),
  };

  return db.sellerPayoutProfile.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
    select: sellerPayoutProfileSafeSelect,
  });
}

export async function revealSellerPayoutProfileAccount({
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
  const profile = await db.sellerPayoutProfile.findUniqueOrThrow({
    where: { id: payoutProfileId },
    select: {
      id: true,
      accountNumberCiphertext: true,
      accountNumberIv: true,
      accountNumberAuthTag: true,
      accountNumberKeyVersion: true,
    },
  });
  if (
    !profile.accountNumberCiphertext ||
    !profile.accountNumberIv ||
    !profile.accountNumberAuthTag ||
    !profile.accountNumberKeyVersion
  ) {
    throw new Error("No encrypted account number is available.");
  }
  const accountNumber = decryptPayoutData({
    ciphertext: Buffer.from(profile.accountNumberCiphertext),
    iv: Buffer.from(profile.accountNumberIv),
    authTag: Buffer.from(profile.accountNumberAuthTag),
    keyVersion: profile.accountNumberKeyVersion,
  });
  await db.sellerPayoutProfileAuditEvent.create({
    data: {
      payoutProfileId,
      actorUserId,
      action: "ACCOUNT_REVEALED",
      metadata: { reason },
    },
  });
  return accountNumber;
}
