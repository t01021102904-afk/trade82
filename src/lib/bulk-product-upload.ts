import { BULK_PRODUCT_MAX_FILE_BYTES } from "@/lib/bulk-product-types";
import type { Locale } from "@/lib/i18n";

type WorkbookFileLike = {
  name: string;
  size: number;
  type: string;
};

const allowedWorkbookMimeTypes = new Set([
  "",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function validateBulkProductWorkbookFile(
  file: WorkbookFileLike,
  locale: Locale,
) {
  if (file.size <= 0 || file.size > BULK_PRODUCT_MAX_FILE_BYTES) {
    return locale === "ko"
      ? "Excel 파일은 5MB 이하여야 합니다."
      : "The Excel workbook must be 5MB or smaller.";
  }
  if (
    !file.name.toLocaleLowerCase().endsWith(".xlsx") ||
    !allowedWorkbookMimeTypes.has(file.type.toLocaleLowerCase())
  ) {
    return locale === "ko"
      ? ".xlsx 파일만 업로드할 수 있습니다."
      : "Only .xlsx workbooks are supported.";
  }
  return null;
}
