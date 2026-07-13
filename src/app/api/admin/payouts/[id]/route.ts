import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { markSellerPayoutSent, setSellerPayoutStatus } from "@/lib/seller-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

function dateField(value: unknown) {
  if (typeof value !== "string") throw new Error("sentAt is required.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("sentAt is invalid.");
  return date;
}

function text(value: unknown, field: string, required = false, max = 500) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const output = value.trim();
  if (output.length > max) throw new Error(`${field} is too long.`);
  if (required && !output) throw new Error(`${field} is required.`);
  return output;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403 });
    }
    const body = await readJsonObject(request);
    const payoutId = idParam((await params).id, "payoutId");
    if (body.action === "hold" || body.action === "processing" || body.action === "failed") {
      await setSellerPayoutStatus({
        payoutId,
        actorUserId: user.id,
        status: body.action === "hold" ? "HOLD" : body.action === "processing" ? "PROCESSING" : "FAILED",
        failureReason: text(body.failureReason, "failureReason", body.action === "failed", 1_000),
      });
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "mark_sent") {
      const result = await markSellerPayoutSent({
        payoutId,
        actorUserId: user.id,
        externalTransferReference: text(body.externalTransferReference, "externalTransferReference", true, 240),
        sentAt: dateField(body.sentAt),
        confirmation: text(body.confirmation, "confirmation", true, 240),
        externalBankReference: text(body.externalBankReference, "externalBankReference", false, 240) || undefined,
      });
      // The payout service needs the full record internally to dispatch the
      // seller notification. The admin browser only needs an acknowledgement;
      // returning the record here would serialize encrypted snapshots and
      // private proof metadata unnecessarily.
      return Response.json(
        { ok: true, alreadySent: result.alreadySent },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ error: "Payout action is invalid." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 409 });
    return apiError(error);
  }
}
