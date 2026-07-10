import type { Metadata } from "next";

import { DatabaseCompanyDetail } from "@/components/database-public-detail";
import { JsonLd } from "@/components/json-ld";
import { getPublicCompanyMetadata } from "@/lib/public-company-metadata";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type CompanyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: CompanyDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return getPublicCompanyMetadata({ id, type: "company" });
}

export default async function CompanyDetailPage({
  params,
}: CompanyDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Sellers", path: "/sellers" },
          { name: "Company", path: `/companies/${encodeURIComponent(id)}` },
        ])}
      />
      <DatabaseCompanyDetail id={id} />
    </>
  );
}
