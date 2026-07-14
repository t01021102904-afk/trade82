import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const profiles = await getDb().sellerPayoutProfile.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true, companyId: true, country: true, bankName: true, accountHolder: true, accountNumberMasked: true, status: true, updatedAt: true,
        company: { select: { legalName: true, tradeName: true } },
      },
    });
    return Response.json({ profiles }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
