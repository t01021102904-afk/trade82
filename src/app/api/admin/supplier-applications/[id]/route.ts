import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  nullableStringField,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  getSupplierApplicationForAdmin,
  supplierApplicationAdminResponse,
} from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const [application, reviewers] = await Promise.all([
      getSupplierApplicationForAdmin(idParam(id)),
      getDb().userProfile.findMany({
        where: { role: "admin", deletedAt: null },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return Response.json(
      { application: supplierApplicationAdminResponse(application), reviewers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-supplier-application-assignment",
      userId: admin.id,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["assignedAdminUserId"]));
    const assignedAdminUserId = nullableStringField(
      body,
      "assignedAdminUserId",
      128,
    );
    if (assignedAdminUserId) {
      const assigned = await getDb().userProfile.findUnique({
        where: { id: assignedAdminUserId },
        select: { role: true },
      });
      if (assigned?.role !== "admin")
        throw new Response("Assigned reviewer must be an administrator.", {
          status: 400,
        });
    }
    const { id } = await context.params;
    const applicationId = idParam(id);
    const application = await getDb().$transaction(async (tx) => {
      const before = await tx.supplierApplication.findUnique({
        where: { id: applicationId },
        select: { assignedAdminUserId: true },
      });
      if (!before)
        throw new Response("Supplier application not found.", { status: 404 });
      const updated = await tx.supplierApplication.update({
        where: { id: applicationId },
        data: { assignedAdminUserId },
      });
      await tx.supplierApplicationAuditEvent.create({
        data: {
          applicationId,
          actorUserId: admin.id,
          action: "ADMIN_ASSIGNED",
          before: { assignedAdminUserId: before.assignedAdminUserId },
          after: { assignedAdminUserId },
        },
      });
      return updated;
    });
    return Response.json({ application });
  } catch (error) {
    return apiError(error);
  }
}
