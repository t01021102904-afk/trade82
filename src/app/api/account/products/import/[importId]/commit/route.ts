import { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  stringArrayField,
} from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createProductSlug, type NormalizedProductInput } from "@/lib/product-input";

type StoredNormalizedRow = {
  sellerSku: string;
  product: NormalizedProductInput;
};

function storedNormalizedRow(value: Prisma.JsonValue | null): StoredNormalizedRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!record.product || typeof record.product !== "object" || Array.isArray(record.product)) {
    return null;
  }
  const sellerSku = typeof record.sellerSku === "string" ? record.sellerSku : "";
  return sellerSku ? ({ sellerSku, product: record.product as NormalizedProductInput } as StoredNormalizedRow) : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user, company } = await requireSeller();
    if (!company) return Response.json({ error: "Seller role required." }, { status: 403 });
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-import-commit",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { importId: rawImportId } = await params;
    const importId = idParam(rawImportId, "importId");
    const body = (await request.json()) as Record<string, unknown>;
    const selectedRowIds = Array.from(
      new Set(stringArrayField(body, "rowIds", { maxItems: 200, maxLength: 128 })),
    );
    if (!selectedRowIds.length) {
      return Response.json({ error: "등록할 정상 상품을 선택해 주세요." }, { status: 400 });
    }

    const db = getDb();
    const importPreview = await db.productBulkImport.findFirst({
      where: { id: importId, sellerCompanyId: company.id, status: "PREVIEWED" },
      include: { rows: { where: { id: { in: selectedRowIds } } } },
    });
    if (!importPreview) {
      return Response.json({ error: "Import preview not found or already committed." }, { status: 404 });
    }
    if (importPreview.rows.length !== selectedRowIds.length) {
      return Response.json({ error: "선택한 행을 확인할 수 없습니다." }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of importPreview.rows) {
      if (row.status !== "VALID") {
        errorCount += 1;
        continue;
      }
      const stored = storedNormalizedRow(row.normalizedData);
      if (!stored) {
        errorCount += 1;
        await db.productBulkImportRow.update({
          where: { id: row.id },
          data: { status: "ERROR", errorMessages: ["미리보기 데이터를 확인할 수 없습니다."] },
        });
        continue;
      }

      try {
        const result = await db.$transaction(async (transaction) => {
          const existing = await transaction.product.findFirst({
            where: { sellerCompanyId: company.id, sellerSku: stored.sellerSku },
            select: { id: true },
          });
          if (existing && importPreview.duplicateMode === "SKIP") {
            await transaction.productBulkImportRow.update({
              where: { id: row.id },
              data: { status: "SKIPPED", resultProductId: existing.id, errorMessages: [] },
            });
            return "skipped" as const;
          }

          const productData = {
            sellerSku: stored.sellerSku,
            ...stored.product,
            status: "draft" as const,
          };
          const product = existing
            ? await transaction.product.update({
                where: { id: existing.id },
                data: productData,
              })
            : await transaction.product.create({
                data: {
                  sellerCompanyId: company.id,
                  slug: `${createProductSlug(stored.product.name) || "product"}-${crypto.randomUUID().slice(0, 8)}`,
                  imageUrl: null,
                  ...productData,
                },
              });
          await transaction.productBulkImportRow.update({
            where: { id: row.id },
            data: {
              status: existing ? "UPDATED" : "CREATED",
              resultProductId: product.id,
              errorMessages: [],
            },
          });
          return existing ? ("updated" as const) : ("created" as const);
        });
        if (result === "created") createdCount += 1;
        if (result === "updated") updatedCount += 1;
        if (result === "skipped") skippedCount += 1;
      } catch {
        errorCount += 1;
        await db.productBulkImportRow.update({
          where: { id: row.id },
          data: { status: "ERROR", errorMessages: ["상품을 초안으로 등록하지 못했습니다."] },
        });
      }
    }

    await db.productBulkImport.update({
      where: { id: importPreview.id },
      data: { status: "COMPLETED", committedAt: new Date() },
    });

    return Response.json({
      createdCount,
      updatedCount,
      skippedCount,
      errorCount,
      draftCount: createdCount + updatedCount,
    });
  } catch (error) {
    return apiError(error);
  }
}
