import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import {
  bulkProductCreateData,
  bulkProductImportIdentity,
  BulkProductWorkbookError,
  parseBulkProductWorkbook,
  validateBulkProductRows,
} from "@/lib/bulk-product-registration";
import { type BulkProductImportResponse } from "@/lib/bulk-product-types";
import { validateBulkProductWorkbookFile } from "@/lib/bulk-product-upload";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json({ error: "Seller company required." }, { status: 403 });
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-bulk-import",
      userId: user.id,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const locale: Locale = formData.get("locale") === "ko" ? "ko" : "en";
    const file = formData.get("file");
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
    const fileError = validateWorkbookFile(file, locale);
    if (fileError) return fileError;
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return Response.json(
        {
          error:
            locale === "ko"
              ? "일괄 생성 요청 ID가 올바르지 않습니다."
              : "The bulk import request ID is invalid.",
        },
        { status: 400 },
      );
    }

    const rows = await parseBulkProductWorkbook(
      Buffer.from(await (file as File).arrayBuffer()),
      locale,
    );
    const existingProducts = await getDb().product.findMany({
      where: { sellerCompanyId: company.id, deletedAt: null },
      select: { name: true },
    });
    const validation = validateBulkProductRows({
      rows,
      locale,
      existingProductNames: existingProducts.map((product) => product.name),
    });
    if (validation.errorRows > 0) {
      return Response.json(
        {
          error:
            locale === "ko"
              ? "검증 오류를 수정한 뒤 다시 업로드해 주세요."
              : "Fix every validation error and upload the workbook again.",
          validation,
        },
        { status: 400 },
      );
    }

    const identities = validation.rows.map((_, index) =>
      bulkProductImportIdentity({
        companyId: company.id,
        idempotencyKey,
        rowIndex: index,
      }),
    );
    const ids = identities.map((identity) => identity.id);
    const createData = validation.rows.map((row, index) =>
      bulkProductCreateData({
        product: row.product,
        sellerCompanyId: company.id,
        id: identities[index].id,
        slugSuffix: identities[index].slugSuffix,
      }),
    );
    const transactionResult = await getDb().$transaction(async (tx) => {
      const lockKey = `bulk-product-import:${company.id}:${idempotencyKey}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const existing = await tx.product.findMany({
        where: { id: { in: ids }, sellerCompanyId: company.id },
        include: { images: { orderBy: { position: "asc" } } },
      });
      if (existing.length === ids.length) {
        const ordered = orderProducts(existing, ids);
        if (
          ordered.some(
            (product, index) => product.slug !== createData[index].slug,
          )
        ) {
          throw new BulkImportConflictError();
        }
        return { duplicateRequest: true, products: ordered };
      }
      if (existing.length) {
        throw new BulkImportConflictError();
      }

      await tx.product.createMany({
        data: createData,
      });
      const created = await tx.product.findMany({
        where: { id: { in: ids }, sellerCompanyId: company.id, deletedAt: null },
        include: { images: { orderBy: { position: "asc" } } },
      });
      if (created.length !== ids.length) {
        throw new Error("Bulk product creation did not return every row.");
      }
      return { duplicateRequest: false, products: orderProducts(created, ids) };
    });

    const response: BulkProductImportResponse = {
      created: transactionResult.products.length,
      duplicateRequest: transactionResult.duplicateRequest,
      products: transactionResult.products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        status: "inactive",
        images: product.images.map((image) => ({
          originalUrl: image.originalUrl,
          cardUrl: image.cardUrl,
          mainUrl: image.mainUrl,
          detailUrl: image.detailUrl,
          storagePath: image.storagePath,
          width: image.width,
          height: image.height,
        })),
      })),
    };

    return Response.json(response, {
      status: transactionResult.duplicateRequest ? 200 : 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof BulkProductWorkbookError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BulkImportConflictError) {
      return Response.json(
        { error: "This bulk import request is in an inconsistent state." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}

class BulkImportConflictError extends Error {}

function validateWorkbookFile(value: FormDataEntryValue | null, locale: Locale) {
  if (!(value instanceof File)) {
    return Response.json(
      {
        error:
          locale === "ko"
            ? "Excel 파일을 선택해 주세요."
            : "Select an Excel workbook.",
      },
      { status: 400 },
    );
  }
  const error = validateBulkProductWorkbookFile(value, locale);
  if (error) return Response.json({ error }, { status: 400 });
  return null;
}

function orderProducts<T extends { id: string }>(products: T[], ids: string[]) {
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...products].sort(
    (left, right) =>
      (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
