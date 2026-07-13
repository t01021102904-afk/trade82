import { PaymentRequestEventType } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { claimPaymentRequestRelease } from "@/lib/payment-request-release";
import { paymentReleaseBlockReason } from "@/lib/payment-request-rules";

const releaseFields = new Set(["action", "payoutReference", "payoutDate", "payoutNote"]);
function parsePayoutDate(value: unknown) {
  if (typeof value !== "string") throw validationError("payoutDate is required.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw validationError("payoutDate must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw validationError("payoutDate is invalid.");
  }
  return date;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-message-payment-payout",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const paymentRequestId = idParam(rawId, "paymentRequestId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, releaseFields);
    if (stringField(body, "action", { max: 64, required: true }) !== "record_manual_payout") {
      throw validationError("Unsupported payment action.");
    }
    const payoutReference = stringField(body, "payoutReference", { max: 240, required: true }) as string;
    const payoutDate = parsePayoutDate(body.payoutDate);
    const payoutNote = stringField(body, "payoutNote", { max: 2_000, required: true }) as string;

    const db = getDb();
    const result = await db.$transaction(async (tx) => {
      const current = await tx.paymentRequest.findUnique({
        where: { id: paymentRequestId },
        select: {
          id: true,
          inquiryId: true,
          status: true,
          refundAmount: true,
          sellerPayableAmount: true,
          releasedAt: true,
          manualPayoutReference: true,
          requiresManualReconciliation: true,
          disputes: { select: { status: true } },
        },
      });
      if (!current) return { error: "Payment request not found.", status: 404 } as const;
      const releaseBlock = paymentReleaseBlockReason({
        status: current.status,
        refundAmount: current.refundAmount,
        requiresManualReconciliation: current.requiresManualReconciliation,
        disputeStatuses: current.disputes.map((dispute) => dispute.status),
      });
      if (releaseBlock === "not_paid") {
        return {
          error: "Only paid payment requests can be released after a manual payout is recorded.",
          status: 409,
        } as const;
      }
      if (releaseBlock === "refunded") {
        return { error: "Refunded payment requests cannot be released.", status: 409 } as const;
      }
      if (releaseBlock === "reconciliation_required") {
        return {
          error: "This payment request requires manual reconciliation before release.",
          status: 409,
        } as const;
      }
      if (releaseBlock === "active_dispute") {
        return { error: "Resolve the active dispute before releasing this payment.", status: 409 } as const;
      }

      const releasedAt = new Date();
      const released = await claimPaymentRequestRelease({
        locker: tx,
        paymentRequestId: current.id,
        sellerPayableAmount: current.sellerPayableAmount,
        releasedAt,
        payoutReference,
        payoutDate,
        payoutNote,
        releasedByUserId: admin.id,
      });
      if (!released) {
        return {
          error: "Payment status changed while the payout was being recorded. Please refresh.",
          status: 409,
        } as const;
      }
      await tx.paymentRequestEvent.create({
        data: {
          paymentRequestId: current.id,
          eventType: PaymentRequestEventType.RELEASED,
          actorUserId: admin.id,
          message: "Admin recorded an external seller payout.",
          metadata: { payoutReference },
        },
      });
      await tx.inquiry.update({ where: { id: current.inquiryId }, data: { updatedAt: releasedAt } });
      return { status: 200, requestId: current.id } as const;
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    const updated = await db.paymentRequest.findUniqueOrThrow({
      where: { id: result.requestId },
      include: {
        buyerCompany: { select: { id: true, legalName: true, tradeName: true } },
        sellerCompany: { select: { id: true, legalName: true, tradeName: true } },
        releasedByUser: { select: { id: true, displayName: true, email: true } },
        disputes: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { status: true, reason: true, amount: true, updatedAt: true },
        },
      },
    });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
