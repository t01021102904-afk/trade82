import { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  normalizeProductBulkImportRow,
  parseProductBulkImportFile,
  ProductBulkImportValidationError,
} from "@/lib/product-bulk-import";

function previewResponse(importPreview: {
  id: string;
  duplicateMode: string;
  rows: Array<{
    id: string;
    rowNumber: number;
    sellerSku: string;
    productName: string;
    category: string;
    status: string;
    errorMessages: string[];
  }>;
}) {
  const rows = [...importPreview.rows].sort((left, right) => left.rowNumber - right.rowNumber);
  return {
    importId: importPreview.id,
    duplicateMode: importPreview.duplicateMode.toLowerCase(),
    rows,
    validCount: rows.filter((row) => row.status === "VALID").length,
    errorCount: rows.filter((row) => row.status === "ERROR").length,
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json({ error: "Seller role required." }, { status: 403 });
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-import-preview",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const duplicateModeValue = String(formData.get("duplicateMode") ?? "skip").toLowerCase();
    const duplicateMode = duplicateModeValue === "update" ? "UPDATE" : "SKIP";
    if (
      !fileValue ||
      typeof fileValue === "string" ||
      !("arrayBuffer" in fileValue) ||
      typeof fileValue.arrayBuffer !== "function"
    ) {
      return Response.json({ error: "상품 파일을 선택해 주세요." }, { status: 400 });
    }

    const parsed = await parseProductBulkImportFile(fileValue as File);
    const prepared = parsed.rows.map(({ rowNumber, values }) => {
      try {
        return {
          rowNumber,
          values,
          normalized: normalizeProductBulkImportRow(values),
          errors: [] as string[],
        };
      } catch (error) {
        return {
          rowNumber,
          values,
          normalized: null,
          errors: [
            error instanceof Error ? error.message : "상품 정보를 확인할 수 없습니다.",
          ],
        };
      }
    });

    const seenSkus = new Set<string>();
    for (const row of prepared) {
      const sku = row.normalized?.sellerSku;
      if (!sku || row.errors.length) continue;
      if (seenSkus.has(sku)) {
        row.normalized = null;
        row.errors.push("업로드 파일에 동일한 seller_sku가 중복되어 있습니다.");
        continue;
      }
      seenSkus.add(sku);
    }

    const db = getDb();
    const existingSkus = await db.product.findMany({
      where: {
        sellerCompanyId: company.id,
        sellerSku: { in: [...seenSkus] },
      },
      select: { sellerSku: true },
    });
    const existingSkuSet = new Set(
      existingSkus.map((product) => product.sellerSku).filter((sku): sku is string => Boolean(sku)),
    );

    const importPreview = await db.productBulkImport.create({
      data: {
        sellerCompanyId: company.id,
        createdByUserId: user.id,
        sourceFilename: parsed.filename || "products-import",
        sourceFormat: parsed.format,
        duplicateMode,
        rows: {
          create: prepared.map((row) => {
            const normalized = row.normalized;
            const sellerSku = normalized?.sellerSku ?? String(row.values.seller_sku ?? "").slice(0, 80);
            return {
              rowNumber: row.rowNumber,
              sellerSku,
              productName: normalized?.product.name ?? String(row.values.product_name ?? "").slice(0, 120),
              category: normalized?.product.category ?? String(row.values.category ?? "").slice(0, 80),
              rawData: row.values as Prisma.InputJsonValue,
              normalizedData: normalized
                ? ({ sellerSku: normalized.sellerSku, product: normalized.product } as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              status: normalized && !row.errors.length ? "VALID" : "ERROR",
              errorMessages: row.errors,
            };
          }),
        },
      },
      include: {
        rows: {
          select: {
            id: true,
            rowNumber: true,
            sellerSku: true,
            productName: true,
            category: true,
            status: true,
            errorMessages: true,
          },
        },
      },
    });

    return Response.json({
      ...previewResponse(importPreview),
      existingSkus: [...existingSkuSet],
    });
  } catch (error) {
    if (error instanceof ProductBulkImportValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}
