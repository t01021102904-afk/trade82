import { BackButton } from "@/components/back-button";
import { ListingCreateForm } from "@/components/listing-create-form";
import { ProductRegistrationModeSwitch } from "@/components/product-registration-mode-switch";
import type { Locale } from "@/lib/i18n";
import { requireApprovedSupplierDashboard } from "@/lib/require-auth";

export async function ListingPage({
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  await requireApprovedSupplierDashboard(pathname);

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <BackButton fallbackHref="/dashboard/seller" />
        <ProductRegistrationModeSwitch />
        <ListingCreateForm />
      </div>
    </div>
  );
}
