import { apiError } from "@/lib/api-response";
import { idParam } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { productBulkImportErrorCsv } from "@/lib/product-bulk-import";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  try {
    const { company } = await requireSeller();
    if (!company) return Response.json({ error: "Seller role required." }, { status: 403 });
    const { importId: rawImportId } = await params;
    const importId = idParam(rawImportId, "importId");
    const importPreview = await getDb().productBulkImport.findFirst({
      where: { id: importId, sellerCompanyId: company.id },
      select: {
        rows: {
          where: { status: "ERROR" },
          orderBy: { rowNumber: "asc" },
          select: {
            rowNumber: true,
            sellerSku: true,
            productName: true,
            category: true,
            errorMessages: true,
          },
        },
      },
    });
    if (!importPreview) return Response.json({ error: "Import preview not found." }, { status: 404 });

    return new Response(productBulkImportErrorCsv(importPreview.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="trade82-product-import-errors.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
