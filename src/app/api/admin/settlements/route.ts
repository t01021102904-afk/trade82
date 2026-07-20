import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const settlements = await getDb().settlement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        paymentFlow: true,
        currency: true,
        grossAmount: true,
        sellerPayableAmount: true,
        partnerReferralAmount: true,
        trade82RetainedAmountBeforeStripeFees: true,
        holdUntil: true,
        holdReason: true,
        approvedAt: true,
        approvedByUser: { select: { displayName: true, email: true } },
        paymentRequest: {
          select: {
            status: true,
            requiresManualReconciliation: true,
            refundAmount: true,
            disputes: { select: { id: true, status: true, amount: true } },
          },
        },
        tradeOrder: {
          select: {
            orderNumber: true,
            buyerCompanyName: true,
            sellerCompanyName: true,
          },
        },
        legs: {
          orderBy: { type: "asc" },
          select: {
            id: true,
            type: true,
            amount: true,
            currency: true,
            status: true,
            holdUntil: true,
            transferredAt: true,
            transferAttemptCount: true,
            nextTransferAttemptAt: true,
            transferLastError: true,
            transferLockedAt: true,
            manualReviewRequired: true,
            recipientCompany: { select: { legalName: true, tradeName: true } },
            partnerProfile: { select: { referralCode: true } },
          },
        },
        reversals: {
          select: {
            id: true,
            settlementLegId: true,
            amount: true,
            currency: true,
            reason: true,
            status: true,
            stripeRefundId: true,
            stripeDisputeId: true,
            requestedAmount: true,
            successfullyReversedAmount: true,
            sourceType: true,
            stripeSourceObjectId: true,
            originalStripeTransferId: true,
            reversalAttemptCount: true,
            manualRequeueCount: true,
            nextReversalAttemptAt: true,
            reversalLockedAt: true,
            reversalLastError: true,
            stripeTransferReversalId: true,
            completedAt: true,
          },
        },
      },
    });
    return Response.json({ settlements }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
