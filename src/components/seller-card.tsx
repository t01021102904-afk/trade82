"use client";

import Link from "next/link";

import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { SaveButton } from "@/components/save-button";
import { VerificationBadge } from "@/components/verification-badge";
import { withLocale } from "@/lib/i18n";
import { getSellerProductCount } from "@/lib/mock-data";
import type { Seller } from "@/lib/types";

export function SellerCard({ seller }: { seller: Seller }) {
  const { locale, t } = useI18n();

  return (
    <article className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start gap-4">
        <CompanyLogo
          companyName={seller.name}
          logoUrl={seller.logoUrl}
          useDefaultLogo={seller.useDefaultLogo ?? true}
          size="sm"
          className="size-12"
        />
        <div className="min-w-0">
          <Link href={withLocale(`/companies/${seller.id}`, locale)}>
            <h3 className="text-lg font-semibold text-zinc-950 transition hover:text-blue-700">
              {seller.name}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-zinc-500">{seller.location}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <VerificationBadge
          status={seller.verificationStatus ?? (seller.verified ? "verified" : "unverified")}
          subject="seller"
        />
        <Badge tone="blue">{t("common.exportExperienced")}</Badge>
        <Badge tone="amber">{t("common.fastResponse")}</Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">{t("sellers.businessType")}</dt>
          <dd className="font-medium text-zinc-900">{seller.businessType}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("sellers.years")}</dt>
          <dd className="font-medium text-zinc-900">{seller.yearsInBusiness}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("sellers.response")}</dt>
          <dd className="font-medium text-zinc-900">{seller.responseTime}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("sellers.rating")}</dt>
          <dd className="font-medium text-zinc-900">
            {seller.rating.toFixed(1)} ({seller.reviewCount})
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("sellers.products")}</dt>
          <dd className="font-medium text-zinc-900">{getSellerProductCount(seller.id)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("sellers.state")}</dt>
          <dd className="font-medium text-zinc-900">{seller.state}</dd>
        </div>
      </dl>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-600">
        {seller.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {seller.categories.map((category) => (
          <Badge key={category}>{category}</Badge>
        ))}
      </div>

      <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
        <Link
          href={withLocale(`/companies/${seller.id}`, locale)}
          className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-200 hover:text-blue-700"
        >
          {t("common.viewCompany")}
        </Link>
        <ContactModal context={{ type: "seller", seller }} buttonLabel={t("common.contact")} />
        <SaveButton id={seller.id} kind="company" className="sm:col-span-2" />
      </div>
    </article>
  );
}
