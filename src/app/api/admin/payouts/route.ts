import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { listAdminPayoutReviewTransactions } from "@/lib/admin-payout-review";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json(
        { error: "Manual payouts are not enabled for this account." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const requestedId = new URL(request.url).searchParams.get("id")?.trim();
    const transactions = await listAdminPayoutReviewTransactions(requestedId);
    return Response.json(
      { transactions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
