"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/badge";
import { CompanyReviewsSection } from "@/components/company-reviews";
import { CompanyLogo } from "@/components/profile-identity";
import { ProductCard } from "@/components/product-card";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { VerificationBadge } from "@/components/verification-badge";
import { ViewTracker } from "@/components/view-tracker";
import type { Product } from "@/lib/types";

type PublicCompany = {
  id: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName: string | null;
  logoUrl: string | null;
  useDefaultLogo: boolean;
  country: string;
  city: string;
  description: string;
  categories: string[];
  reviewsReceived: Array<{
    id: string;
    rating: number;
    reviewText: string;
    contractValue: string;
    currency: string;
    publicValueDisplay: "hidden" | "exact" | "range";
    createdAt: string;
    reviewerCompany: { legalName: string; tradeName: string | null };
  }>;
};

type PublicPayload = {
  companies: PublicCompany[];
  products: Array<Record<string, unknown>>;
};

function usePublicMarketplace() {
  const [payload, setPayload] = useState<PublicPayload>({
    companies: [],
    products: [],
  });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) =>
        response.ok ? response.json() : { companies: [], products: [] },
      )
      .then((value: PublicPayload) => {
        setPayload(value);
        setLoaded(true);
      });
  }, []);
  return { payload, loaded };
}

export function DatabaseCompanyDetail({ id }: { id: string }) {
  const { payload, loaded } = usePublicMarketplace();
  const company = payload.companies.find((item) => item.id === id);
  const companyProducts = payload.products
    .filter((item) => (item.sellerCompany as { id?: string })?.id === id)
    .map(publicProductToCard);
  const average = company?.reviewsReceived.length
    ? company.reviewsReceived.reduce((sum, review) => sum + review.rating, 0) /
      company.reviewsReceived.length
    : 0;

  if (!loaded) return <PublicLoading />;
  if (!company) return <PublicUnavailable />;

  return (
    <div className="bg-zinc-50">
      <ViewTracker id={company.id} type="company" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6">
        <section className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 sm:flex-row">
          <CompanyLogo companyName={company.tradeName || company.legalName} logoUrl={company.logoUrl ?? undefined} useDefaultLogo={company.useDefaultLogo} size="lg" shape="circle" />
          <div>
            <VerificationBadge status="verified" subject={company.companyRole} />
            <h1 className="mt-3 text-4xl font-semibold text-zinc-950">{company.tradeName || company.legalName}</h1>
            <p className="mt-2 text-sm text-zinc-500">{company.city}, {company.country}</p>
            <p className="mt-4 max-w-3xl leading-7 text-zinc-600">{company.description}</p>
          </div>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-zinc-950">Completed-deal reviews</h2>
          <p className="mt-1 text-sm text-zinc-500">{average.toFixed(1)}/5 · {company.reviewsReceived.length} reviews</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {company.reviewsReceived.map((review) => <ReviewCard key={review.id} review={review} />)}
          </div>
        </section>
        <CompanyReviewsSection companyId={company.id} companyRole={company.companyRole} />
        {companyProducts.length ? <section><h2 className="mb-4 text-xl font-semibold text-zinc-950">Products</h2><div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">{companyProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div></section> : null}
      </div>
    </div>
  );
}

export function DatabaseProductDetail({ id }: { id: string }) {
  const { payload, loaded } = usePublicMarketplace();
  const raw = payload.products.find((item) => item.id === id);
  const product = raw ? publicProductToCard(raw) : null;
  if (!loaded) return <PublicLoading />;
  if (!product) return <PublicUnavailable />;
  return (
    <div className="bg-zinc-50"><ViewTracker id={id} type="product" /><div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]"><ProductImageGallery images={product.imageUrls ?? [product.imagePlaceholder]} productName={product.name} /><section className="rounded-lg border border-zinc-200 bg-white p-6"><VerificationBadge status="verified" subject="seller" /><p className="mt-5 text-sm font-medium text-blue-700">{product.category}</p><h1 className="mt-2 text-4xl font-semibold text-zinc-950">{product.name}</h1><p className="mt-4 leading-7 text-zinc-600">{product.longDescription}</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Price" value={product.wholesalePrice} /><Detail label="MOQ" value={product.moq} /><Detail label="Lead time" value={product.leadTime} /><Detail label="Origin" value={product.countryOfOrigin} /></dl></section></div></div>
  );
}

function ReviewCard({ review }: { review: PublicCompany["reviewsReceived"][number] }) {
  return <article className="rounded-lg border border-zinc-200 bg-white p-5"><div className="flex flex-wrap gap-2"><Badge tone="green">Completed Deal Review</Badge><Badge tone="blue">{review.rating}/5</Badge></div><p className="mt-4 text-sm leading-6 text-zinc-700">{review.reviewText}</p><p className="mt-3 text-xs text-zinc-500">{review.reviewerCompany.tradeName || review.reviewerCompany.legalName} · {formatContract(review)}</p></article>;
}

function formatContract(review: PublicCompany["reviewsReceived"][number]) {
  if (review.publicValueDisplay === "hidden") return "Contract value hidden";
  const value = Number(review.contractValue);
  if (review.publicValueDisplay === "exact") return `${review.currency} ${value.toLocaleString()}`;
  if (value < 50000) return "$10k-$50k";
  if (value < 100000) return "$50k-$100k";
  if (value < 500000) return "$100k-$500k";
  return "$500k+";
}

function publicProductToCard(value: Record<string, unknown>): Product {
  const company = (value.sellerCompany ?? {}) as Record<string, unknown>;
  const images = Array.isArray(value.images)
    ? (value.images as Array<Record<string, unknown>>)
    : [];
  const priceMin = value.priceMin ? Number(value.priceMin) : 0;
  const priceMax = value.priceMax ? Number(value.priceMax) : priceMin;
  return { id: String(value.id), name: String(value.name), category: value.category as Product["category"], sellerId: String(company.id), sellerName: String(company.tradeName ?? company.legalName ?? ""), sellerLocation: [company.city, company.country].filter(Boolean).join(", "), sellerLogoUrl: typeof company.logoUrl === "string" ? company.logoUrl : undefined, sellerUseDefaultLogo: company.useDefaultLogo !== false, shortDescription: String(value.shortDescription ?? ""), longDescription: String(value.detailedDescription ?? ""), wholesalePrice: priceMin ? `${String(value.currency ?? "USD")} ${priceMin}${priceMax !== priceMin ? `-${priceMax}` : ""}` : "Price on request", wholesalePriceValue: priceMin, moq: String(value.moq ?? ""), moqUnits: Number(String(value.moq ?? "").replace(/\D/g, "")) || 0, leadTime: String(value.leadTime ?? ""), monthlyCapacity: "Contact seller", sampleAvailable: false, privateLabelAvailable: false, countryOfOrigin: "South Korea", shippingOrigin: String(company.country ?? "South Korea"), incoterms: ["Contact seller"], hsCode: "Contact seller", certifications: Array.isArray(value.certifications) ? value.certifications as string[] : [], documentsAvailable: [], packageSize: String(value.packaging ?? ""), unitsPerCarton: "Contact seller", cartonWeight: "Contact seller", koreanMarketFit: String(value.ingredientsOrMaterials ?? ""), suggestedSalesChannels: [], riskNotes: [], imagePlaceholder: String(images[0]?.cardUrl ?? value.imageUrl ?? "/window.svg"), imageUrls: images.map((image) => String(image.detailUrl ?? image.mainUrl ?? image.cardUrl)), tags: Array.isArray(value.tags) ? value.tags as string[] : [], createdAt: String(value.createdAt ?? new Date().toISOString()), verificationStatus: "verified" };
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-sm text-zinc-500">{label}</dt><dd className="mt-1 font-medium text-zinc-950">{value}</dd></div>; }
function PublicLoading() { return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-600">Loading...</div>; }
function PublicUnavailable() { return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-600">This listing is unavailable.</div>; }
