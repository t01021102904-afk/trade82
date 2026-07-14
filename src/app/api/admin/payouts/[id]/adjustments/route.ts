import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { isSellerPayoutAdjustmentType } from "@/lib/seller-payout-adjustment-rules";
import { addSellerPayoutAdjustment } from "@/lib/seller-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store" };

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const output = value.trim();
  if (!output) throw new Error(`${field} is required.`);
  if (output.length > maxLength) throw new Error(`${field} is too long.`);
  return output;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const output = value.trim();
  if (output.length > maxLength) throw new Error(`${field} is too long.`);
  return output || undefined;
}

function positiveMinorUnits(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("amount must be a positive integer minor-unit value.");
  }
  return value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    const payoutId = idParam((await params).id, "payoutId");
    const adjustmentType = requiredText(body.adjustmentType, "adjustmentType", 32);
    if (!isSellerPayoutAdjustmentType(adjustmentType)) {
      return Response.json({ error: "Adjustment type is invalid." }, { status: 400, headers: noStore });
    }
    const result = await addSellerPayoutAdjustment({
      payoutId,
      actorUserId: user.id,
      adjustmentType,
      amount: positiveMinorUnits(body.amount),
      currency: requiredText(body.currency, "currency", 12),
      reason: requiredText(body.reason, "reason", 1_000),
      internalNote: optionalText(body.internalNote, "internalNote", 2_000),
      confirmation: requiredText(body.confirmation, "confirmation", 240),
    });
    return Response.json(
      {
        ok: true,
        adjustment: {
          id: result.adjustment.id,
          adjustmentType: result.adjustment.adjustmentType,
          amount: result.adjustment.amount,
          currency: result.adjustment.currency,
          reason: result.adjustment.reason,
          internalNote: result.adjustment.internalNote,
          requiresManualReconciliation: result.adjustment.requiresManualReconciliation,
          createdAt: result.adjustment.createdAt,
        },
        reconciliationRequired: result.reconciliationRequired,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 409, headers: noStore });
    }
    return apiError(error);
  }
}
