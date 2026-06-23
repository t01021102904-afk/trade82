import Link from "next/link";

import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { DetailTable } from "@/components/detail-table";
import { ProductCard } from "@/components/product-card";
import { SaveButton } from "@/components/save-button";
import { VerificationBadge } from "@/components/verification-badge";
import { CompanyLogo } from "@/components/profile-identity";
import { DatabaseCompanyDetail } from "@/components/database-public-detail";
import { CompanyReviewsSection } from "@/components/company-reviews";
import {
  getProductsBySeller,
  getSeller,
} from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seller = getSeller(id);

  if (!seller) {
    return <DatabaseCompanyDetail id={id} />;
  }

  const sellerProducts = getProductsBySeller(seller.id);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-5">
              <CompanyLogo
                companyName={seller.name}
                logoUrl={seller.logoUrl}
                useDefaultLogo={seller.useDefaultLogo ?? true}
                size="lg"
                shape="circle"
              />
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <VerificationBadge
                    status={seller.verificationStatus ?? (seller.verified ? "verified" : "unverified")}
                    subject="seller"
                  />
                  <Badge tone="blue">Export Experienced</Badge>
                  <Badge tone="amber">Fast Response</Badge>
                </div>
                <h1 className="text-4xl font-semibold text-zinc-950">{seller.name}</h1>
                <p className="mt-2 text-sm text-zinc-500">
                  {seller.location} · {seller.businessType}
                </p>
                <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
                  {seller.description}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <SaveButton id={seller.id} kind="company" />
              <ContactModal context={{ type: "seller", seller }} buttonLabel="Contact seller" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Years in business", seller.yearsInBusiness],
            ["Monthly capacity", seller.monthlyCapacity],
            ["Response time", seller.responseTime],
            ["Export markets", seller.exportCountries.length],
            ["Minimum order level", sellerProducts[0]?.moq ?? "By product"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-6">
            <div>
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">Company profile</h2>
              <DetailTable
                rows={[
                  { label: "Company name", value: seller.name },
                  { label: "Location", value: seller.location },
                  { label: "Business type", value: seller.businessType },
                  { label: "Year founded", value: seller.yearFounded },
                  { label: "Rating", value: `${seller.rating.toFixed(1)} (${seller.reviewCount} reviews)` },
                  { label: "Contact person", value: seller.contactPerson },
                  { label: "Contact email", value: seller.contactEmail },
                  { label: "Website", value: seller.website },
                  { label: "Languages", value: seller.languages.join(", ") },
                ]}
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">About company</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{seller.description}</p>
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">
                Export and logistics capabilities
              </h2>
              <DetailTable
                rows={[
                  { label: "Export countries", value: seller.exportCountries.join(", ") },
                  { label: "Export experience", value: seller.exportExperience },
                  { label: "Payment terms", value: seller.paymentTerms.join(", ") },
                  { label: "Incoterms supported", value: seller.incoterms.join(", ") },
                  { label: "Documents provided", value: seller.documentsAvailable.join(", ") },
                ]}
              />
            </div>

            <CompanyReviewsSection
              companyId={seller.id}
              companyRole="seller"
            />
          </div>

          <aside className="grid h-fit gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">Product categories</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {seller.categories.map((category) => (
                  <Badge key={category} tone="blue">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">Certifications</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {seller.certifications.map((certification) => (
                  <Badge key={certification} tone="green">
                    {certification}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-semibold text-blue-950">Trade note</h2>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                BridgeMarket reviews submitted profile information for marketplace
                quality but does not guarantee claims or transaction outcomes.
              </p>
            </div>
          </aside>
        </section>

        <section className="grid gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-zinc-950">
              Products from this seller
            </h2>
            <Link href="/marketplace" className="text-sm font-medium text-blue-700">
              Browse all products
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {sellerProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
