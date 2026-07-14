import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
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
    const payouts = await getDb().sellerPayout.findMany({
      where: new URL(request.url).searchParams.get("id")?.trim()
        ? { id: new URL(request.url).searchParams.get("id")!.trim() }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      // Never serialize encrypted beneficiary snapshots or raw storage paths to
      // the admin list. Full bank details require the audited POST reveal action.
      select: {
        id: true,
        payoutNumber: true,
        status: true,
        currency: true,
        grossAmount: true,
        platformFeeAmount: true,
        sellerPayableAmount: true,
        refundAdjustmentAmount: true,
        manualAdjustmentAmount: true,
        finalPayoutAmount: true,
        processingFeeAmount: true,
        bankNameSnapshot: true,
        accountNumberLast4: true,
        swiftBicSnapshot: true,
        officialBankWebsiteSnapshot: true,
        sentAt: true,
        adjustments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            adjustmentType: true,
            amount: true,
            currency: true,
            reason: true,
            internalNote: true,
            requiresManualReconciliation: true,
            createdAt: true,
            createdByUser: { select: { displayName: true, email: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            buyerCompanyName: true,
            sellerCompanyName: true,
            items: { take: 1, orderBy: { createdAt: "asc" }, select: { productName: true } },
          },
        },
        sellerCompany: { select: { id: true, legalName: true, tradeName: true } },
      },
    });
    return Response.json({ payouts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
