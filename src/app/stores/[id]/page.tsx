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
  return getPublicCompanyMetadata({ id, type: "store" });
}

export default async function StoreDetailPage({
  params,
}: StoreDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Sellers", path: "/sellers" },
          { name: "Store", path: `/stores/${encodeURIComponent(id)}` },
        ])}
      />
      <DatabaseCompanyDetail id={id} />
    </>
  );
}
