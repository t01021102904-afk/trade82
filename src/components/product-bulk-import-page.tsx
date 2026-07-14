import { BackButton } from "@/components/back-button";
import { ProductBulkImportClient } from "@/components/product-bulk-import-client";
import type { Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export async function ProductBulkImportPage({
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  await requireDashboardRole(pathname, "seller");

  return (
    <div className="min-h-screen theme-bg">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <BackButton fallbackHref="/dashboard/seller" />
        <ProductBulkImportClient />
      </main>
    </div>
  );
}
