import type { Metadata } from "next";

import { DatabaseCompanyDetail } from "@/components/database-public-detail";
import { JsonLd } from "@/components/json-ld";
import { getPublicCompanyMetadata } from "@/lib/public-company-metadata";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type StoreDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: StoreDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return getPublicCompanyMetadata({ id, localePrefix: "/en", type: "store" });
}

export default async function EnStoreDetailPage({
  params,
}: StoreDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/en" },
          { name: "Sellers", path: "/en/sellers" },
          { name: "Store", path: `/en/stores/${encodeURIComponent(id)}` },
        ])}
      />
      <DatabaseCompanyDetail id={id} />
    </>
  );
}
