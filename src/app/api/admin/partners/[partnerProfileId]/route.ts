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
import {
  getPartnerLifecycleTransition,
  type PartnerLifecycleAction,
} from "@/lib/partner-lifecycle";
import { lockPartnerProfileById } from "@/lib/partner-profile-locks";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const fields = new Set(["action", "reason"]);
const actions = new Set<PartnerLifecycleAction>([
  "approve",
  "reactivate",
  "reject",
  "suspend",
]);

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
    if (!action || !actions.has(action as PartnerLifecycleAction)) {
      throw validationError("Action is invalid.");
    }
    const reason = stringField(body, "reason", { max: 500, fallback: null });
    if ((action === "reject" || action === "suspend") && !reason) {
      throw validationError("A reason is required.");
    }

    const result = await getDb().$transaction(async (tx) => {
      const current = await lockPartnerProfileById(tx, partnerProfileId);
      if (!current) return null;
      const nextStatus = getPartnerLifecycleTransition(
        action as PartnerLifecycleAction,
        current.status,
      );
      if (!nextStatus) return { invalidTransition: true as const };
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
      return { invalidTransition: false as const, status: nextStatus };
    });
    if (!result) return Response.json({ error: "Partner profile not found." }, { status: 404, headers: noStore });
    if (result.invalidTransition) {
      return Response.json(
        { error: "Partner status transition is not allowed." },
        { status: 409, headers: noStore },
      );
    }
    return Response.json({ ok: true, status: result.status }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
