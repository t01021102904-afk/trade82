import { apiError } from "@/lib/api-response";
import { idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createSignedPrivateFileUrl } from "@/lib/supabase-storage";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id, documentId } = await context.params;
    const applicationId = idParam(id);
    const document = await getDb().supplierApplicationDocument.findFirst({
      where: { id: idParam(documentId, "documentId"), applicationId },
      select: { storagePath: true },
    });
    if (!document) throw new Response("Document not found.", { status: 404 });
    await getDb().supplierApplicationAuditEvent.create({
      data: {
        applicationId,
        actorUserId: admin.id,
        action: "ADMIN_DOCUMENT_SIGNED_URL_ISSUED",
        before: {},
        after: { documentId: idParam(documentId, "documentId") },
      },
    });
    return Response.json(
      { url: await createSignedPrivateFileUrl(document.storagePath) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
