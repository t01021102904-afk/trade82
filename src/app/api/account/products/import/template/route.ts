import ExcelJS from "exceljs";

import { apiError } from "@/lib/api-response";
import { requireSeller } from "@/lib/authz";
import { productBulkImportColumns } from "@/lib/product-bulk-import";

export async function GET(request: Request) {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json({ error: "Seller role required." }, { status: 403 });
    }

    const format = new URL(request.url).searchParams.get("format");
    if (format !== "csv" && format !== "xlsx") {
      return Response.json({ error: "format must be csv or xlsx." }, { status: 400 });
    }

    if (format === "csv") {
      return new Response(`${productBulkImportColumns.join(",")}\r\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="trade82-product-import-template.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");
    worksheet.addRow([...productBulkImportColumns]);
    const instructions = workbook.addWorksheet("Instructions");
    instructions.addRows([
      ["Trade82 product bulk import"],
      ["Required columns", "seller_sku, product_name, category, detailed_description"],
      ["Multiple values", "Use | to separate values, for example: EXW|FOB"],
      [
        "Field visibility",
        "Use key:level pairs, for example: minimumUnitPrice:public|moq:inquiry_required",
      ],
      ["Draft only", "Imported products are always drafts until images are added and the product is published."],
    ]);
    const content = await workbook.xlsx.writeBuffer();

    return new Response(content, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="trade82-product-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
