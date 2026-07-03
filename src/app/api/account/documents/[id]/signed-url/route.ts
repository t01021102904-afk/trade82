import { apiError } from "@/lib/api-response";
import { idParam } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createSignedTradeDocumentUrl } from "@/lib/document-storage";
import { StorageConfigurationError } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Create a company profile before opening documents." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const documentId = idParam(id, "id");
    const document = await getDb().tradeDocument.findFirst({
      where: { id: documentId, companyId: company.id },
      select: { storagePath: true },
    });
    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const url = await createSignedTradeDocumentUrl(document.storagePath, 300);
    return Response.json(
      { url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return apiError(error);
  }
}
