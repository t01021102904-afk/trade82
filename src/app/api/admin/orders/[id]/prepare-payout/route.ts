import { apiError } from "@/lib/api-response";
import { idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { prepareSellerPayout } from "@/lib/seller-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403 });
    }
    const payout = await prepareSellerPayout({ orderId: idParam((await params).id, "orderId"), actorUserId: user.id });
    return Response.json({ payout }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 409 });
    return apiError(error);
  }
}
