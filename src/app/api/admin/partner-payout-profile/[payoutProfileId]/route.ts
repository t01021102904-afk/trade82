import { PartnerPayoutProfileStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  assertSameOrigin,
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
import { setPartnerPayoutVerification } from "@/lib/partner-payout-profiles";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const fields = new Set(["action", "reason"]);
const actions = {
  verify: PartnerPayoutProfileStatus.VERIFIED,
  reject: PartnerPayoutProfileStatus.REJECTED,
  disable: PartnerPayoutProfileStatus.DISABLED,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ payoutProfileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-partner-payout-verification",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const payoutProfileId = idParam((await params).payoutProfileId, "payoutProfileId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, fields);
    const action = stringField(body, "action", { max: 32, required: true });
    if (!action || !(action in actions)) throw validationError("Action is invalid.");
    const reason = stringField(body, "reason", { max: 500, fallback: null });
    if ((action === "reject" || action === "disable") && !reason) {
      throw validationError("A reason is required.");
    }
    const result = await getDb().$transaction(async (tx) => {
      const profile = await tx.partnerPayoutProfile.findFirst({
        where: { id: payoutProfileId, partnerProfile: { deletedAt: null } },
        select: { id: true, status: true },
      });
      if (!profile) return null;
      return setPartnerPayoutVerification({
        db: tx,
        payoutProfileId: profile.id,
        actorUserId: admin.id,
        status: actions[action as keyof typeof actions],
        reason: reason ?? undefined,
      });
    });
    if (!result) return Response.json({ error: "Payout profile not found." }, { status: 404, headers: noStore });
    return Response.json({ ok: true, status: result.status }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
