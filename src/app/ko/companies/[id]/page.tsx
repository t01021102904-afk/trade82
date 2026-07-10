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
  return getPublicCompanyMetadata({ id, localePrefix: "/ko", type: "company" });
}

export default async function KoCompanyDetailPage({
  params,
}: CompanyDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/ko" },
          { name: "셀러", path: "/ko/sellers" },
          { name: "회사", path: `/ko/companies/${encodeURIComponent(id)}` },
        ])}
      />
      <DatabaseCompanyDetail id={id} />
    </>
  );
}
