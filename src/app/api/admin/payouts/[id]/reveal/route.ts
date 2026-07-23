import { apiError } from "@/lib/api-response";
import { decryptPayoutData } from "@/lib/payout-crypto";
import { assertSameOrigin, idParam, rateLimitOrResponse, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
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
      scope: "admin-payout-reveal",
      userId: user.id,
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const payoutId = idParam((await params).id, "payoutId");
    const reason = revealReason((await readJsonObject(request)).reason);
    const result = await getDb().$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUniqueOrThrow({
        where: { id: payoutId },
        select: {
          beneficiarySnapshotEncrypted: true,
          beneficiarySnapshotIv: true,
          beneficiarySnapshotAuthTag: true,
          beneficiarySnapshotKeyVersion: true,
        },
      });
      const instructions = decryptPayoutData({
        ciphertext: Buffer.from(payout.beneficiarySnapshotEncrypted),
        iv: Buffer.from(payout.beneficiarySnapshotIv),
        authTag: Buffer.from(payout.beneficiarySnapshotAuthTag),
        keyVersion: payout.beneficiarySnapshotKeyVersion,
      });
      await tx.sellerPayoutEvent.create({
        data: {
          payoutId,
          actorUserId: user.id,
          eventType: "BANK_DETAILS_REVEALED",
          message: "Admin revealed bank instructions.",
          metadata: { reason },
        },
      });
      return JSON.parse(instructions) as Record<string, unknown>;
    });
    return Response.json({ instructions: result }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return apiError(error);
  }
}
