import { ListingCreateForm } from "@/components/listing-create-form";
import { getDictionary, type Locale } from "@/lib/i18n";
import { requireDashboardRole } from "@/lib/require-auth";

export async function ListingPage({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  await requireDashboardRole(pathname, "seller");
  const messages = getDictionary(locale);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm font-semibold text-blue-700">
            {messages.listing.pageLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
            {messages.listing.pageTitle}
          </h1>
        </div>
        <ListingCreateForm />
      </div>
    </div>
  );
}
