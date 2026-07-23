import { apiError } from "@/lib/api-response";
import { assertSameOrigin, idParam, rateLimitOrResponse, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { revealPartnerPayoutInstructions } from "@/lib/partner-payouts";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

function revealReason(value: unknown) {
  if (typeof value !== "string") throw new Error("A reveal reason is required.");
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new Error("Reveal reason must be between 3 and 500 characters.");
  }
  return reason;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    assertSameOrigin(request);
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-partner-payout-reveal",
      userId: user.id,
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json(
        { error: "Manual payouts are not enabled for this account." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const payoutId = idParam((await params).id, "partnerPayoutId");
    const reason = revealReason((await readJsonObject(request)).reason);
    const instructions = await revealPartnerPayoutInstructions({
      payoutId,
      actorUserId: user.id,
      reason,
    });
    return Response.json(
      { instructions },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
