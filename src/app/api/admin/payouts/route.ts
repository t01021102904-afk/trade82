import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
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
    const payouts = await getDb().sellerPayout.findMany({
      where: requestedId
        ? { id: requestedId }
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
    const partnerPayouts = await getDb().partnerPayout.findMany({
      where: requestedId ? { id: requestedId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        payoutNumber: true,
        status: true,
        currency: true,
        originalCommissionAmount: true,
        reversalAdjustmentAmount: true,
        finalPayoutAmount: true,
        holdUntil: true,
        bankNameSnapshot: true,
        accountNumberLast4: true,
        accountNumberMasked: true,
        partnerLegalNameSnapshot: true,
        partnerDisplayNameSnapshot: true,
        partnerOrganizationSnapshot: true,
        partnerEmailSnapshot: true,
        partnerPhoneSnapshot: true,
        partnerResidenceCountrySnapshot: true,
        requiresManualReconciliation: true,
        sentAt: true,
        failedAt: true,
        failureReason: true,
        externalTransferReference: true,
        externalBankReference: true,
        settlement: {
          select: {
            id: true,
            status: true,
            grossAmount: true,
            platformFeeAmount: true,
            sellerPayableAmount: true,
            partnerReferralAmount: true,
            trade82RetainedAmountBeforeStripeFees: true,
            currency: true,
            paymentFlow: true,
            holdUntil: true,
            paymentRequest: {
              select: {
                id: true,
                status: true,
                grossAmount: true,
                platformFeeAmount: true,
                sellerPayableAmount: true,
                stripeProcessingFeeAmount: true,
                refundAmount: true,
                currency: true,
                paidAt: true,
                requiresManualReconciliation: true,
                disputes: { select: { id: true, status: true, amount: true } },
              },
            },
            tradeOrder: {
              select: {
                id: true,
                orderNumber: true,
                orderStatus: true,
                paymentStatus: true,
                paidAt: true,
                buyerCompanyName: true,
                buyerContactName: true,
                buyerEmail: true,
                buyerPhone: true,
                buyerCountry: true,
                sellerCompanyName: true,
                sellerContactName: true,
                sellerEmail: true,
                sellerPhone: true,
                items: { take: 1, orderBy: { createdAt: "asc" }, select: { productName: true } },
              },
            },
          },
        },
        settlementLeg: {
          select: { id: true, type: true, status: true, amount: true, currency: true, holdUntil: true },
        },
        partnerProfile: {
          select: {
            id: true,
              status: true,
            displayName: true,
            legalName: true,
            contactEmail: true,
            contactPhone: true,
          },
        },
        payoutProfile: { select: { id: true, status: true, accountNumberMasked: true, accountNumberLast4: true } },
      },
    });
    const unifiedPayouts = [
      ...payouts.map((payout) => ({ recipientType: "seller" as const, sellerPayout: payout, partnerPayout: null })),
      ...partnerPayouts.map((payout) => ({ recipientType: "partner" as const, sellerPayout: null, partnerPayout: payout })),
    ].sort((a, b) => {
      const aDate = (a.sellerPayout?.sentAt ?? a.partnerPayout?.sentAt ?? "9999").toString();
      const bDate = (b.sellerPayout?.sentAt ?? b.partnerPayout?.sentAt ?? "9999").toString();
      return bDate.localeCompare(aDate);
    });
    return Response.json(
      { transactions, payouts, partnerPayouts, unifiedPayouts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
