import { ListingCreateForm } from "@/components/listing-create-form";
import type { Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export async function ListingPage({
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  await requireDashboardRole(pathname, "seller");

  return (
    <div className="bg-[#05070a]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ListingCreateForm />
      </div>
    </div>
  );
}
