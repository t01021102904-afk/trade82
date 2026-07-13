import { apiError } from "@/lib/api-response";
import { idParam, readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    if (body.action !== "copied" && body.action !== "downloaded") {
      return Response.json({ error: "Instruction export action is invalid." }, { status: 400, headers: noStore });
    }
    const payoutId = idParam((await params).id, "payoutId");
    await getDb().sellerPayoutEvent.create({
      data: {
        payoutId,
        actorUserId: user.id,
        eventType: "INSTRUCTIONS_EXPORTED",
        message: `Admin ${body.action} payout instructions after an audited reveal.`,
        metadata: { action: body.action },
      },
    });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}
