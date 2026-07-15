import { apiError } from "@/lib/api-response";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { listActiveKoreanSellerPayoutBanks } from "@/lib/seller-payout-bank-directory";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  try {
    await requireSeller();
    const banks = await listActiveKoreanSellerPayoutBanks(getDb());
    return Response.json({ banks }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}
