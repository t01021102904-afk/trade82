import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { revealPartnerPayoutAccount } from "@/lib/partner-payout-profiles";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ payoutProfileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-partner-payout-reveal",
      userId: admin.id,
      limit: 6,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const payoutProfileId = idParam((await params).payoutProfileId, "payoutProfileId");
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["reason"]));
    const reason = requiredStringField(body, "reason", 500);
    const accountNumber = await getDb().$transaction(async (tx) => {
      const profile = await tx.partnerPayoutProfile.findFirst({
        where: { id: payoutProfileId, partnerProfile: { deletedAt: null } },
        select: { id: true },
      });
      if (!profile) return null;
      return revealPartnerPayoutAccount({
        db: tx,
        payoutProfileId: profile.id,
        actorUserId: admin.id,
        reason,
      });
    });
    if (!accountNumber) return Response.json({ error: "Payout profile not found." }, { status: 404, headers: noStore });
    return Response.json({ accountNumber }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
