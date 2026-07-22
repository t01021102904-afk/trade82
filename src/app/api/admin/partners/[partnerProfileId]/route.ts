import { PartnerProfileStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  stringField,
  validationError,
  validationErrorResponse,
  ApiValidationError,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const fields = new Set(["action", "reason"]);
const actions = {
  approve: PartnerProfileStatus.ACTIVE,
  reactivate: PartnerProfileStatus.ACTIVE,
  reject: PartnerProfileStatus.REJECTED,
  suspend: PartnerProfileStatus.SUSPENDED,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerProfileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-partner-status",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const partnerProfileId = idParam(
      (await params).partnerProfileId,
      "partnerProfileId",
    );
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, fields);
    const action = stringField(body, "action", { max: 32, required: true });
    if (!action || !(action in actions)) throw validationError("Action is invalid.");
    const reason = stringField(body, "reason", { max: 500, fallback: null });
    if ((action === "reject" || action === "suspend") && !reason) {
      throw validationError("A reason is required.");
    }

    const result = await getDb().$transaction(async (tx) => {
      const current = await tx.partnerProfile.findUnique({
        where: { id: partnerProfileId },
        select: { id: true, status: true, deletedAt: true },
      });
      if (!current || current.deletedAt) return null;
      const nextStatus = actions[action as keyof typeof actions];
      if (current.status === nextStatus && action !== "approve" && action !== "reactivate") {
        return { status: current.status };
      }
      await tx.partnerProfile.update({
        where: { id: current.id },
        data: { status: nextStatus },
      });
      await tx.partnerProfileAuditEvent.create({
        data: {
          partnerProfileId: current.id,
          actorUserId: admin.id,
          action: `STATUS_${nextStatus}`,
          metadata: reason ? { reason } : {},
        },
      });
      return { status: nextStatus };
    });
    if (!result) return Response.json({ error: "Partner profile not found." }, { status: 404, headers: noStore });
    return Response.json({ ok: true, status: result.status }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
