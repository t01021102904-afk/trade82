import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  revealSellerPayoutProfileAccount,
  sellerPayoutProfileSafeSelect,
} from "@/lib/seller-payout-profiles";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function revealReason(value: unknown) {
  if (typeof value !== "string") throw new Error("A reveal reason is required.");
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new Error("Reveal reason must be between 3 and 500 characters.");
  }
  return reason;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const profile = await getDb().sellerPayoutProfile.findUnique({
      where: { id: idParam((await params).id, "payoutProfileId") },
      select: sellerPayoutProfileSafeSelect,
    });
    if (!profile) return Response.json({ error: "Payout profile not found." }, { status: 404, headers: noStore });
    return Response.json({ profile }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const payoutProfileId = idParam((await params).id, "payoutProfileId");
    const body = await readJsonObject(request);
    const action = body.action;
    if (action === "reveal") {
      const reason = revealReason(body.reason);
      const accountNumber = await getDb().$transaction((tx) =>
        revealSellerPayoutProfileAccount({
          db: tx,
          payoutProfileId,
          actorUserId: user.id,
          reason,
        }),
      );
      return Response.json({ accountNumber }, { headers: noStore });
    }
    if (action !== "verify" && action !== "reject" && action !== "disable") {
      return Response.json({ error: "Payout profile action is invalid." }, { status: 400, headers: noStore });
    }
    const target = await getDb().sellerPayoutProfile.findUnique({
      where: { id: payoutProfileId },
      select: { company: { select: { ownerUserId: true } } },
    });
    if (!target) {
      return Response.json({ error: "Payout profile not found." }, { status: 404, headers: noStore });
    }
    if (action === "verify" && target.company.ownerUserId === user.id) {
      return Response.json(
        { error: "Administrators cannot verify their own seller payout profile." },
        { status: 403, headers: noStore },
      );
    }
    const profile = await getDb().sellerPayoutProfile.update({
      where: { id: payoutProfileId },
      data:
        action === "verify"
          ? { status: "VERIFIED", verifiedAt: new Date(), verifiedByUserId: user.id }
          : action === "reject"
            ? { status: "REJECTED", verifiedAt: null, verifiedByUserId: null }
            : { status: "DISABLED", verifiedAt: null, verifiedByUserId: null },
      select: sellerPayoutProfileSafeSelect,
    });
    await getDb().sellerPayoutProfileAuditEvent.create({
      data: { payoutProfileId, actorUserId: user.id, action: `PROFILE_${String(action).toUpperCase()}` },
    });
    return Response.json({ profile }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}
