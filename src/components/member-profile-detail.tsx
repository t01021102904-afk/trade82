"use client";

import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { CompanyLogo } from "@/components/profile-identity";
import { VerificationBadge } from "@/components/verification-badge";
import { useI18n } from "@/components/i18n-provider";
import {
  useCompanyProfiles,
  useVerificationSubmissions,
} from "@/lib/storage-hooks";
import {
  submissionToBuyer,
  submissionToSeller,
} from "@/lib/verification-profiles";

export function MemberSellerDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const submissions = useVerificationSubmissions();
  const companies = useCompanyProfiles();
  const seller = submissions
    .map((submission) =>
      submissionToSeller(
        submission,
        companies.find(
          (company) =>
            company.ownerClerkUserId === submission.userId &&
            company.companyRole === "seller",
        ),
      ),
    )
    .find((item) => item?.id === id);

  if (!seller) {
    return <UnavailableProfile />;
  }

  return (
    <MemberProfileShell>
      <div className="flex items-start gap-5">
        <CompanyLogo
          companyName={seller.name}
          logoUrl={seller.logoUrl}
          useDefaultLogo={seller.useDefaultLogo ?? true}
          size="lg"
          shape="circle"
        />
        <div className="grid gap-2">
          <VerificationBadge status="verified" subject="seller" />
          <h1 className="text-2xl font-semibold text-zinc-950 sm:text-3xl">{seller.name}</h1>
        </div>
      </div>
      <p className="text-sm text-zinc-500">{seller.location}</p>
      <p className="max-w-3xl text-sm leading-6 text-zinc-600">
        {seller.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {seller.categories.map((category) => (
          <Badge key={category} tone="blue">
            {category}
          </Badge>
        ))}
      </div>
      <ContactModal
        context={{ type: "seller", seller }}
        buttonLabel={t("common.contactSeller")}
        className="w-fit"
      />
    </MemberProfileShell>
  );
}

export function MemberBuyerDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const submissions = useVerificationSubmissions();
  const companies = useCompanyProfiles();
  const buyer = submissions
    .map((submission) =>
      submissionToBuyer(
        submission,
        companies.find(
          (company) =>
            company.ownerClerkUserId === submission.userId &&
            company.companyRole === "buyer",
        ),
      ),
    )
    .find((item) => item?.id === id);

  if (!buyer) {
    return <UnavailableProfile />;
  }

  return (
    <MemberProfileShell>
      <div className="flex items-start gap-5">
        <CompanyLogo
          companyName={buyer.name}
          logoUrl={buyer.logoUrl}
          useDefaultLogo={buyer.useDefaultLogo ?? true}
          size="lg"
          shape="circle"
        />
        <div className="grid gap-2">
          <VerificationBadge status="verified" subject="buyer" />
          <h1 className="text-2xl font-semibold text-zinc-950 sm:text-3xl">{buyer.name}</h1>
        </div>
      </div>
      <p className="text-sm text-zinc-500">{buyer.location}</p>
      <p className="max-w-3xl text-sm leading-6 text-zinc-600">
        {buyer.marketStrategy}
      </p>
      <div className="flex flex-wrap gap-2">
        {buyer.interestedCategories.map((category) => (
          <Badge key={category} tone="blue">
            {category}
          </Badge>
        ))}
      </div>
      <ContactModal
        context={{ type: "buyer", buyer }}
        buttonLabel={t("common.contactBuyer")}
        className="w-fit"
      />
    </MemberProfileShell>
  );
}

function MemberProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-6">
          {children}
        </section>
      </div>
    </div>
  );
}

function UnavailableProfile() {
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
          This profile is unavailable or not listed yet.
        </div>
      </div>
    </div>
  );
}
