"use client";

import { Badge } from "@/components/badge";
import { CompanyLogo } from "@/components/profile-identity";
import { VerificationBadge } from "@/components/verification-badge";
import { managedProductToPublic } from "@/lib/managed-products";
import {
  useCompanyProfiles,
  useManagedProducts,
} from "@/lib/storage-hooks";

export function ManagedProductDetail({ id }: { id: string }) {
  const products = useManagedProducts();
  const companies = useCompanyProfiles();
  const managedProduct = products.find((product) => product.id === id);
  const company = companies.find(
    (item) => item.id === managedProduct?.companyId,
  );
  const product = managedProduct
    ? managedProductToPublic(managedProduct, company)
    : null;

  if (!product || !company) {
    return (
      <div className="bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-600 sm:px-6">
          This product is unavailable or is not currently public.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-[420px] rounded-lg bg-zinc-100 bg-cover bg-center"
          style={{ backgroundImage: `url(${product.imagePlaceholder})` }}
          aria-label={product.name}
        />
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <VerificationBadge status="verified" subject="seller" />
            <Badge tone="green">Active</Badge>
            {managedProduct?.exportReady ? <Badge tone="blue">Export Ready</Badge> : null}
          </div>
          <p className="mt-5 text-sm font-medium text-blue-700">{product.category}</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">{product.name}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{product.longDescription}</p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Price" value={product.wholesalePrice} />
            <Detail label="MOQ" value={product.moq} />
            <Detail label="Lead time" value={product.leadTime} />
            <Detail label="Origin" value={product.countryOfOrigin} />
            <Detail label="Packaging" value={product.packageSize} />
            <Detail label="Certifications" value={product.certifications.join(", ") || "None listed"} />
          </dl>
          <div className="mt-7 flex items-center gap-3 border-t border-zinc-100 pt-5">
            <CompanyLogo
              companyName={company.tradeName || company.legalName}
              logoUrl={company.logoUrl}
              useDefaultLogo={company.useDefaultLogo}
              size="sm"
            />
            <div>
              <p className="font-semibold text-zinc-950">
                {company.tradeName || company.legalName}
              </p>
              <p className="text-sm text-zinc-500">
                {company.city}, {company.country}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-950">{value}</dd>
    </div>
  );
}
