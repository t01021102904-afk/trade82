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
    <article className="bm-premium-card flex h-full min-w-0 flex-col rounded-lg border p-4 theme-surface">
      <div className="relative z-10 flex min-w-0 items-start gap-4">
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
            <h3 className="truncate text-base font-semibold theme-foreground transition hover:text-[var(--accent-foreground)]">
              {seller.name}
            </h3>
          </Link>
            {seller.isTrade82Team ? <AdminBadge /> : null}
          </div>
          <p className="mt-1 truncate text-sm theme-muted">{seller.location}</p>
        </div>
      </div>

      {seller.exportExperience || seller.responseTime ? (
        <div className="relative z-10 mt-4 flex min-w-0 flex-wrap gap-2 overflow-hidden">
          {seller.exportExperience ? <Badge tone="blue">{t("common.exportExperienced")}</Badge> : null}
          {seller.responseTime ? <Badge tone="amber">{t("common.fastResponse")}</Badge> : null}
        </div>
      ) : null}

      <dl className="relative z-10 mt-4 grid min-w-0 grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.businessType")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">{seller.businessType || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.years")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">{seller.yearsInBusiness || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.response")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">{seller.responseTime || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.rating")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">
            {seller.rating.toFixed(1)} ({seller.reviewCount})
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.products")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">{seller.productCount ?? notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate theme-muted">{t("sellers.state")}</dt>
          <dd className="line-clamp-2 break-words font-medium theme-foreground">{seller.state}</dd>
        </div>
      </dl>

      <p className="relative z-10 mt-4 line-clamp-3 break-words text-sm leading-6 theme-muted">
        {seller.description}
      </p>

      <div className="relative z-10 mt-4 flex min-w-0 flex-wrap gap-2 overflow-hidden">
        {seller.categories.map((category) => (
          <Badge key={category}>{category}</Badge>
        ))}
      </div>

      <div className="relative z-10 mt-auto grid gap-2 pt-4 sm:grid-cols-2">
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
