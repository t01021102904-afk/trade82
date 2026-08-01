import "server-only";

import { Prisma } from "@/generated/prisma/client";

// Every commerce authorization mutation uses this transaction-scoped key. Keep
// the key derivation and acquisition order centralized so supplier status,
// brand eligibility, payment requests, and payment finalization serialize on
// the same seller-company boundary.
export async function lockSupplierCommerceBoundary(
  tx: Prisma.TransactionClient,
  sellerCompanyId: string,
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`supplier-commerce:${sellerCompanyId}`}, 0)
    )
  `;
}
