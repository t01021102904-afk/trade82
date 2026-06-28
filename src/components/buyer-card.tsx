"use client";

import Link from "next/link";

import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { SaveButton } from "@/components/save-button";
import { withLocale } from "@/lib/i18n";
import type { Buyer } from "@/lib/types";

export function BuyerCard({ buyer }: { buyer: Buyer }) {
  const { locale, t } = useI18n();
  const notProvided = t("common.notProvided");

  return (
    <article className="bm-premium-card flex h-full min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <div className="relative z-10 flex min-w-0 items-start gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyLogo
            companyName={buyer.name}
            logoUrl={buyer.logoUrl}
            useDefaultLogo={buyer.useDefaultLogo ?? true}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Link href={withLocale(`/buyers/${buyer.id}`, locale)} className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-zinc-950 transition hover:text-blue-700">
                {buyer.name}
              </h3>
            </Link>
              {buyer.isTrade82Team ? <AdminBadge /> : null}
            </div>
            <p className="mt-1 truncate text-sm text-zinc-500">
              {buyer.location || notProvided}
            </p>
          </div>
        </div>
      </div>

      <dl className="relative z-10 mt-5 grid min-w-0 grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="truncate text-zinc-500">{t("buyers.buyerType")}</dt>
          <dd className="line-clamp-2 break-words font-medium text-zinc-900">{buyer.buyerType || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-zinc-500">{t("buyers.timeline")}</dt>
          <dd className="line-clamp-2 break-words font-medium text-zinc-900">{buyer.timeline || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-zinc-500">{t("buyers.targetSize")}</dt>
          <dd className="line-clamp-2 break-words font-medium text-zinc-900">{buyer.targetOrderSize || notProvided}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-zinc-500">{t("buyers.importVolume")}</dt>
          <dd className="line-clamp-2 break-words font-medium text-zinc-900">{buyer.annualImportVolume || notProvided}</dd>
        </div>
      </dl>

      <div className="relative z-10 mt-4 flex min-w-0 flex-wrap gap-2 overflow-hidden">
        {buyer.interestedCategories.map((category) => (
          <Badge key={category} tone="blue">
            {category}
          </Badge>
        ))}
      </div>

      <p className="relative z-10 mt-4 line-clamp-3 break-words text-sm leading-6 text-zinc-600">
        {buyer.importExperience}
      </p>

      <p className="relative z-10 mt-4 line-clamp-2 break-words text-xs font-medium text-zinc-500">
        {t("buyers.channels")}:{" "}
        {buyer.salesChannels.length
          ? buyer.salesChannels.slice(0, 4).join(" / ")
          : notProvided}
      </p>

      <div className="relative z-10 mt-auto grid gap-2 pt-5 sm:grid-cols-2">
        <Link
          href={withLocale(`/buyers/${buyer.id}`, locale)}
          className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-200 hover:text-blue-700"
        >
          {t("common.viewBuyer")}
        </Link>
        <ContactModal context={{ type: "buyer", buyer }} buttonLabel={t("common.contactBuyer")} />
        <SaveButton id={buyer.id} kind="company" className="sm:col-span-2" />
      </div>
    </article>
  );
}
