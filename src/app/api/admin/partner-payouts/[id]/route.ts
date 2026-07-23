import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { markPartnerPayoutSent, setPartnerPayoutStatus } from "@/lib/partner-payouts";
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
    const payoutId = idParam((await params).id, "partnerPayoutId");
    if (body.action === "hold" || body.action === "processing" || body.action === "failed" || body.action === "returned") {
      await setPartnerPayoutStatus({
        payoutId,
        actorUserId: user.id,
        status:
          body.action === "hold"
            ? "HOLD"
            : body.action === "processing"
              ? "PROCESSING"
              : body.action === "returned"
                ? "RETURNED"
                : "FAILED",
        failureReason: text(body.failureReason, "failureReason", body.action === "failed" || body.action === "returned", 1_000),
      });
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "mark_sent") {
      const result = await markPartnerPayoutSent({
        payoutId,
        actorUserId: user.id,
        externalTransferReference: text(body.externalTransferReference, "externalTransferReference", true, 240),
        sentAt: dateField(body.sentAt),
        confirmation: text(body.confirmation, "confirmation", true, 240),
        externalBankReference: text(body.externalBankReference, "externalBankReference", false, 240) || undefined,
      });
      return Response.json(
        { ok: true, alreadySent: result.alreadySent },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ error: "Partner payout action is invalid." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 409 });
    return apiError(error);
  }
}
