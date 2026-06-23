"use client";

import Link from "next/link";

import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { withLocale } from "@/lib/i18n";
import type { Buyer } from "@/lib/types";
import { VerificationBadge } from "@/components/verification-badge";
import { SaveButton } from "@/components/save-button";

export function BuyerCard({ buyer }: { buyer: Buyer }) {
  const { locale, t } = useI18n();

  return (
    <article className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyLogo
            companyName={buyer.name}
            logoUrl={buyer.logoUrl}
            useDefaultLogo={buyer.useDefaultLogo ?? true}
            size="sm"
          />
          <div className="min-w-0">
            <Link href={withLocale(`/buyers/${buyer.id}`, locale)}>
              <h3 className="text-lg font-semibold text-zinc-950 transition hover:text-blue-700">
                {buyer.name}
              </h3>
            </Link>
            <p className="mt-1 text-sm text-zinc-500">{buyer.location}</p>
          </div>
        </div>
        <VerificationBadge
          status={buyer.verificationStatus ?? (buyer.verified ? "verified" : "unverified")}
          subject="buyer"
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">{t("buyers.buyerType")}</dt>
          <dd className="font-medium text-zinc-900">{buyer.buyerType}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("buyers.timeline")}</dt>
          <dd className="font-medium text-zinc-900">{buyer.timeline}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("buyers.targetSize")}</dt>
          <dd className="font-medium text-zinc-900">{buyer.targetOrderSize}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("buyers.importVolume")}</dt>
          <dd className="font-medium text-zinc-900">{buyer.annualImportVolume}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {buyer.interestedCategories.map((category) => (
          <Badge key={category} tone="blue">
            {category}
          </Badge>
        ))}
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-600">
        {buyer.importExperience}
      </p>

      <p className="mt-4 text-xs font-medium text-zinc-500">
        {t("buyers.channels")}: {buyer.salesChannels.slice(0, 4).join(" / ")}
      </p>

      <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
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
