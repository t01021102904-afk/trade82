import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { DetailTable } from "@/components/detail-table";
import { DatabaseProductDetail } from "@/components/database-public-detail";
import { ProductCard } from "@/components/product-card";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { CompanyLogo } from "@/components/profile-identity";
import { SaveButton } from "@/components/save-button";
import { VerificationBadge } from "@/components/verification-badge";
import { CompanyReviewsSection } from "@/components/company-reviews";
import {
  getProduct,
  getProductsBySeller,
  getSeller,
} from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);

  if (!product) {
    return <DatabaseProductDetail id={id} />;
  }

  const seller = getSeller(product.sellerId);

  if (!seller) {
    notFound();
  }

  const relatedProducts = getProductsBySeller(product.sellerId)
    .filter((item) => item.id !== product.id)
    .slice(0, 3);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <ProductImageGallery
            images={product.imageUrls ?? [product.imagePlaceholder]}
            productName={product.name}
          />
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <VerificationBadge
                  status={seller.verificationStatus ?? (seller.verified ? "verified" : "unverified")}
                  subject="seller"
                />
                <Badge tone="blue">Import Ready</Badge>
                {product.sampleAvailable ? <Badge tone="green">Sample Available</Badge> : null}
                {product.privateLabelAvailable ? <Badge tone="amber">Private Label</Badge> : null}
              </div>
              <p className="text-sm font-medium text-blue-700">{product.category}</p>
              <h1 className="mt-2 text-4xl font-semibold text-zinc-950">{product.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                {product.longDescription}
              </p>
              <div className="mt-5 flex items-center gap-3 text-sm text-zinc-600">
                <CompanyLogo
                  companyName={seller.name}
                  logoUrl={seller.logoUrl}
                  useDefaultLogo={seller.useDefaultLogo ?? true}
                  size="sm"
                />
                <div>
                  Sold by{" "}
                  <Link
                    href={`/companies/${seller.id}`}
                    className="font-semibold text-zinc-950 hover:text-blue-700"
                  >
                    {seller.name}
                  </Link>
                  <p>{product.sellerLocation}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <SaveButton id={product.id} kind="product" />
              <ContactModal
                context={{ type: "product", product }}
                buttonLabel="Contact seller"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Wholesale price", product.wholesalePrice],
            ["MOQ", product.moq],
            ["Lead time", product.leadTime],
            ["Monthly capacity", product.monthlyCapacity],
            ["Sample availability", product.sampleAvailable ? "Samples available" : "Ask seller"],
            ["Shipping origin", product.shippingOrigin],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">Overview</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {product.shortDescription}
              </p>
              <p className="mt-4 text-sm leading-6 text-zinc-600">
                {product.koreanMarketFit}
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">Trade Details</h2>
              <DetailTable
                rows={[
                  { label: "Wholesale price", value: product.wholesalePrice },
                  { label: "MOQ", value: product.moq },
                  { label: "Lead time", value: product.leadTime },
                  { label: "Monthly supply capacity", value: product.monthlyCapacity },
                  {
                    label: "Private label",
                    value: product.privateLabelAvailable ? "Available" : "Not listed",
                  },
                  { label: "Country of origin", value: product.countryOfOrigin },
                  { label: "Shipping origin", value: product.shippingOrigin },
                  { label: "Incoterms", value: product.incoterms.join(", ") },
                  { label: "HS code", value: product.hsCode },
                  { label: "Shelf life", value: product.shelfLife ?? "Not applicable" },
                ]}
              />
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">
                Compliance & Documents
              </h2>
              <DetailTable
                rows={[
                  {
                    label: "Certifications",
                    value: (
                      <div className="flex flex-wrap gap-2">
                        {product.certifications.map((item) => (
                          <Badge key={item} tone="green">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                  {
                    label: "Documents available",
                    value: product.documentsAvailable.join(", "),
                  },
                  {
                    label: "Risk notes",
                    value: product.riskNotes.join(" "),
                  },
                ]}
              />
            </div>

            <div>
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">
                Packaging & Logistics
              </h2>
              <DetailTable
                rows={[
                  { label: "Package size", value: product.packageSize },
                  { label: "Units per carton", value: product.unitsPerCarton },
                  { label: "Carton weight", value: product.cartonWeight },
                  { label: "Suggested Korean channels", value: product.suggestedSalesChannels.join(", ") },
                ]}
              />
            </div>
          </div>

          <aside className="grid h-fit gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <CompanyLogo
                  companyName={seller.name}
                  logoUrl={seller.logoUrl}
                  useDefaultLogo={seller.useDefaultLogo ?? true}
                  size="sm"
                />
                <h2 className="text-xl font-semibold text-zinc-950">Seller Information</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{seller.description}</p>
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Company</dt>
                  <dd className="font-medium text-zinc-950">{seller.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Rating</dt>
                  <dd className="font-medium text-zinc-950">
                    {seller.rating.toFixed(1)} ({seller.reviewCount})
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Response</dt>
                  <dd className="font-medium text-zinc-950">{seller.responseTime}</dd>
                </div>
              </dl>
              <Link
                href={`/companies/${seller.id}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
              >
                View company profile
              </Link>
            </div>

            <CompanyReviewsSection companyId={seller.id} companyRole="seller" />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">Import review reminder</h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                BridgeMarket centralizes submitted trade information, but U.S. buyers should
                independently review import regulations, FDA/FTC requirements,
                labeling rules, product claims, and payment terms.
              </p>
            </div>
          </aside>
        </section>

        {relatedProducts.length ? (
          <section className="grid gap-5">
            <h2 className="text-xl font-semibold text-zinc-950">
              More products from {seller.name}
            </h2>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
