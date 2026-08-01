import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import { requireApprovedSupplierCapability } from "@/lib/authz";
import {
  BulkProductWorkbookError,
  parseBulkProductWorkbook,
  validateBulkProductRows,
} from "@/lib/bulk-product-registration";
import {
  validateBulkProductWorkbookFile,
} from "@/lib/bulk-product-upload";
import { getDb } from "@/lib/db";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, company } = await requireApprovedSupplierCapability("canUploadLiveInventory");
    if (!company) {
      return Response.json({ error: "Seller company required." }, { status: 403 });
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-bulk-validate",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const locale: Locale = formData.get("locale") === "ko" ? "ko" : "en";
    const file = formData.get("file");
    const fileError = validateWorkbookFile(file, locale);
    if (fileError) return fileError;

    const rows = await parseBulkProductWorkbook(
      Buffer.from(await (file as File).arrayBuffer()),
      locale,
    );
    const existingProducts = await getDb().product.findMany({
      where: {
        sellerCompanyId: company.id,
        deletedAt: null,
      },
      select: { name: true },
    });
    const result = validateBulkProductRows({
      rows,
      locale,
      existingProductNames: existingProducts.map((product) => product.name),
    });

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof BulkProductWorkbookError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}

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
