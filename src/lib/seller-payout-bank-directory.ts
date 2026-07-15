import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { KOREAN_PAYOUT_COUNTRY } from "@/lib/seller-payout-profile-rules";

export const sellerPayoutBankSelect = {
  id: true,
  bankNameLocal: true,
  bankNameEnglish: true,
} satisfies Prisma.BankDirectorySelect;

type SellerPayoutBankDirectoryDb = Pick<Prisma.TransactionClient, "bankDirectory">;

export async function listActiveKoreanSellerPayoutBanks(db: SellerPayoutBankDirectoryDb) {
  return db.bankDirectory.findMany({
    where: { countryCode: KOREAN_PAYOUT_COUNTRY, isActive: true },
    orderBy: { bankNameEnglish: "asc" },
    select: sellerPayoutBankSelect,
  });
}

export async function findActiveKoreanSellerPayoutBank(
  db: SellerPayoutBankDirectoryDb,
  id: string,
) {
  return db.bankDirectory.findFirst({
    where: { id, countryCode: KOREAN_PAYOUT_COUNTRY, isActive: true },
    select: sellerPayoutBankSelect,
  });
}
