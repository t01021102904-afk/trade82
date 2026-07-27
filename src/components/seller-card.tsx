"use client";

import Link from "next/link";

import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { withLocale } from "@/lib/i18n";
import type { Seller } from "@/lib/types";

export function SellerCard({ seller }: { seller: Seller }) {
  const { locale, t } = useI18n();
  const notProvided = t("common.notProvided");

  return (
    <article className="flex h-full min-w-0 flex-col border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400">
      <div className="flex min-w-0 items-start gap-3">
        <CompanyLogo
          companyName={seller.name}
          logoUrl={seller.logoUrl}
          useDefaultLogo={seller.useDefaultLogo ?? true}
          size="sm"
          className="size-12"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link href={withLocale(`/companies/${seller.id}`, locale)} className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-[-0.02em] text-zinc-950 transition hover:text-[#34B386]">
                {seller.name}
              </h3>
            </Link>
            {seller.isTrade82Team ? <AdminBadge /> : null}
          </div>
          <p className="mt-1 truncate text-sm text-zinc-500">{seller.location}</p>
        </div>
      </div>

      {seller.exportExperience ? (
        <div className="mt-4 flex min-w-0 flex-wrap gap-2 overflow-hidden">
          {seller.exportExperience ? <Badge>{t("common.exportExperienced")}</Badge> : null}
        </div>
      ) : null}

      <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-y border-zinc-200 py-3 text-sm">
        <div className="min-w-0">
          <dt className="truncate text-xs text-zinc-500">{t("sellers.businessType")}</dt>
          <dd className="mt-1 line-clamp-2 break-words font-medium text-zinc-950">{seller.businessType || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-zinc-500">{t("sellers.products")}</dt>
          <dd className="mt-1 line-clamp-2 break-words font-medium text-zinc-950">{seller.productCount ?? notProvided}</dd>
        </div>
      </dl>

      <p className="mt-3 line-clamp-3 min-h-[3.75rem] break-words text-sm leading-5 text-zinc-600">
        {seller.description}
      </p>

      <div className="mt-3 flex min-w-0 flex-wrap gap-2 overflow-hidden">
        {seller.categories.slice(0, 3).map((category) => (
          <Badge key={category}>{category}</Badge>
        ))}
      </div>

      <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2">
        <Link
          href={withLocale(`/companies/${seller.id}`, locale)}
          className="inline-flex items-center justify-center rounded-md border px-3.5 py-2 text-sm font-medium transition theme-secondary-button"
        >
          {t("common.viewCompany")}
        </Link>
        <ContactModal context={{ type: "seller", seller }} buttonLabel={t("common.contactCompany")} />
      </div>
    </article>
  );
}
