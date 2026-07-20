import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { inspectSettlementOperations } from "@/lib/settlement-operations-control-plane";
import { SettlementLegStatus, SettlementLegType, SettlementPaymentFlow } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const paymentFlow = url.searchParams.get("paymentFlow");
    const legType = url.searchParams.get("legType");
    const status = url.searchParams.get("status");
    const currency = url.searchParams.get("currency");
    const seller = url.searchParams.get("seller");
    const partner = url.searchParams.get("partner");
    const disputeStatus = url.searchParams.get("disputeStatus");
    const refundStatus = url.searchParams.get("refundStatus");
    const fromValue = url.searchParams.get("from");
    const toValue = url.searchParams.get("to");
    const retryDue = url.searchParams.get("retryDue");
    const stale = url.searchParams.get("stale");
    const manualReview = url.searchParams.get("manualReview");
    const from = fromValue ? new Date(fromValue) : undefined;
    const to = toValue ? new Date(toValue) : undefined;
    const validatedDisputeStatus = disputeStatus === "none" || ["open", "won", "lost", "prevented", "warning_closed", "charge_refunded"].includes(disputeStatus ?? "") ? disputeStatus ?? undefined : undefined;
    const validatedRefundStatus = refundStatus === "none" || refundStatus === "partial" || refundStatus === "full" ? refundStatus : undefined;
    return Response.json({
      ok: true,
      ...(await inspectSettlementOperations({
        filters: {
          ...(paymentFlow === SettlementPaymentFlow.SCT || paymentFlow === SettlementPaymentFlow.DIRECT_CHARGE ? { paymentFlow } : {}),
          ...(Object.values(SettlementLegType).includes(legType as SettlementLegType) ? { legType: legType as SettlementLegType } : {}),
          ...(Object.values(SettlementLegStatus).includes(status as SettlementLegStatus) ? { status: status as SettlementLegStatus } : {}),
          ...(currency ? { currency } : {}),
          ...(seller ? { seller } : {}),
          ...(partner ? { partner } : {}),
          ...(validatedDisputeStatus ? { disputeStatus: validatedDisputeStatus } : {}),
          ...(validatedRefundStatus ? { refundStatus: validatedRefundStatus } : {}),
          ...(from && !Number.isNaN(from.getTime()) ? { from } : {}),
          ...(to && !Number.isNaN(to.getTime()) ? { to } : {}),
          ...(retryDue === "true" ? { retryDue: true } : {}),
          ...(stale === "true" ? { stale: true } : {}),
          ...(manualReview === "true" ? { manualReview: true } : manualReview === "false" ? { manualReview: false } : {}),
        },
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
