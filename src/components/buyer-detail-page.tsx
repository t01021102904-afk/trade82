import { Badge } from "@/components/badge";
import { ContactModal } from "@/components/contact-modal";
import { DetailTable } from "@/components/detail-table";
import { getDictionary, type Locale } from "@/lib/i18n";
import { buyers, getBuyer } from "@/lib/mock-data";
import { VerificationBadge } from "@/components/verification-badge";
import { DatabaseCompanyDetail } from "@/components/database-public-detail";
import { CompanyLogo } from "@/components/profile-identity";
import { CompanyReviewsSection } from "@/components/company-reviews";

export function generateBuyerStaticParams() {
  return buyers.flatMap((buyer, index) => [
    { id: buyer.id },
    { id: String(index + 1) },
  ]);
}

const labels = {
  en: {
    verifiedProfile: "Reviewed buyer profile",
    profileReview: "Profile under review",
    buyerCompany: "Buyer company",
    location: "Location",
    targetOrderSize: "Target order size",
    annualImportVolume: "Annual import volume",
    targetTimeline: "Target timeline",
    interestedCategories: "Interested categories",
    salesChannels: "Sales channels",
    importExperience: "Import experience",
    requiredDocuments: "Required documents",
    preferredPaymentTerms: "Preferred payment terms",
    companyVerification: "Company listing status",
    contactPerson: "Contact person",
    contactEmail: "Contact email",
  },
  ko: {
    verifiedProfile: "검토 완료 바이어 프로필",
    profileReview: "프로필 검토 중",
    buyerCompany: "바이어 회사",
    location: "위치",
    targetOrderSize: "목표 주문 규모",
    annualImportVolume: "연간 수입 규모",
    targetTimeline: "목표 일정",
    interestedCategories: "관심 카테고리",
    salesChannels: "판매 채널",
    importExperience: "수입 경험",
    requiredDocuments: "필요 문서",
    preferredPaymentTerms: "선호 결제 조건",
    companyVerification: "회사 공개 상태",
    contactPerson: "담당자",
    contactEmail: "담당자 이메일",
  },
} satisfies Record<Locale, Record<string, string>>;

export function BuyerDetailPageContent({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}) {
  const buyer = getBuyer(id);
  const messages = getDictionary(locale);
  const t = labels[locale];

  if (!buyer) {
    return <DatabaseCompanyDetail id={id} />;
  }

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-5">
              <CompanyLogo
                companyName={buyer.name}
                logoUrl={buyer.logoUrl}
                useDefaultLogo={buyer.useDefaultLogo ?? true}
                size="lg"
                shape="circle"
              />
              <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <VerificationBadge
                  status={buyer.verificationStatus ?? (buyer.verified ? "verified" : "unverified")}
                  subject="buyer"
                />
                <Badge tone="blue">{buyer.buyerType}</Badge>
              </div>
              <h1 className="text-4xl font-semibold text-zinc-950">{buyer.name}</h1>
              <p className="mt-2 text-sm text-zinc-500">{buyer.location}</p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
                {buyer.marketStrategy}
              </p>
              </div>
            </div>
            <ContactModal
              context={{ type: "buyer", buyer }}
              buttonLabel={messages.common.contactBuyer}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            [messages.buyers.buyerType, buyer.buyerType],
            [t.targetOrderSize, buyer.targetOrderSize],
            [t.annualImportVolume, buyer.annualImportVolume],
            [messages.buyers.timeline, buyer.timeline],
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
              <h2 className="mb-3 text-xl font-semibold text-zinc-950">
                {messages.buyer.requirements}
              </h2>
              <DetailTable
                rows={[
                  { label: t.buyerCompany, value: buyer.name },
                  { label: t.location, value: buyer.location },
                  { label: messages.buyers.buyerType, value: buyer.buyerType },
                  {
                    label: t.interestedCategories,
                    value: buyer.interestedCategories.join(", "),
                  },
                  { label: t.targetOrderSize, value: buyer.targetOrderSize },
                  { label: t.annualImportVolume, value: buyer.annualImportVolume },
                  { label: t.salesChannels, value: buyer.salesChannels.join(", ") },
                  { label: t.importExperience, value: buyer.importExperience },
                  { label: t.requiredDocuments, value: buyer.requiredDocuments.join(", ") },
                  {
                    label: t.preferredPaymentTerms,
                    value: buyer.preferredPaymentTerms.join(", "),
                  },
                  { label: t.targetTimeline, value: buyer.timeline },
                  {
                    label: t.companyVerification,
                    value: buyer.verified ? t.verifiedProfile : t.profileReview,
                  },
                  { label: t.contactPerson, value: buyer.contactPerson },
                  { label: t.contactEmail, value: buyer.contactEmail },
                ]}
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">
                {messages.buyer.marketStrategy}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{buyer.marketStrategy}</p>
            </div>

            <CompanyReviewsSection companyId={buyer.id} companyRole="buyer" />
          </div>

          <aside className="grid h-fit gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">
                {messages.buyer.interestedCategories}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {buyer.interestedCategories.map((category) => (
                  <Badge key={category} tone="blue">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-zinc-950">
                {messages.buyer.salesChannels}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {buyer.salesChannels.map((channel) => (
                  <Badge key={channel}>{channel}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-semibold text-blue-950">{messages.buyer.sellerFit}</h2>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                {messages.buyer.sellerFitText}
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
