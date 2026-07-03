"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/badge";
import { CompanyReviewsSection } from "@/components/company-reviews";
import { ContactModal } from "@/components/contact-modal";
import { DetailTable } from "@/components/detail-table";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { ProductCard } from "@/components/product-card";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { VerificationBadge } from "@/components/verification-badge";
import { ViewTracker } from "@/components/view-tracker";
import { SaveButton } from "@/components/save-button";
import { useUserContext } from "@/hooks/use-user-context";
import {
  buyerCategoryLabel,
  buyerTypeLabel as buyerTypeOptionLabel,
  complianceClaimLabel,
  countryLabel,
  incotermLabel,
  importExperienceLabel,
  importVolumeLabel,
  koreanRegionLabel,
  leadTimeLabel,
  moqUnitLabel,
  optionLabels,
  orderSizeLabel,
  priceUnitLabel,
  privateLabelAvailabilityLabel,
  salesChannelLabel,
  sampleAvailabilityLabel,
  sellerDocumentLabel,
  sellerSupplierTypeLabel,
  sourcingTimelineLabel,
  stateLabel,
  supplierTypeLabel as buyerSupplierTypeLabel,
  SOUTH_KOREA,
  UNITED_STATES,
} from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";
import {
  normalizeProductFieldVisibility,
  productFieldVisibilityKeys,
  type ProductFieldVisibility,
  type ProductFieldVisibilityKey,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";
import type { Product, VerificationStatus } from "@/lib/types";

type PublicCompany = {
  id: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName: string | null;
  logoOriginalUrl: string | null;
  logoThumbnailUrl: string | null;
  logoUrl: string | null;
  useDefaultLogo: boolean;
  country: string;
  city: string;
  stateOrProvince: string;
  website: string;
  description: string;
  categories: string[];
  verificationStatus: VerificationStatus;
  owner?: {
    displayName: string;
    jobTitle: string;
  };
  sellerProfile?: {
    representativeName: string;
    exportExperience: string;
    exportCountries: string[];
    productCategories: string[];
    minimumOrderQuantity: string;
    leadTime: string;
    certifications: string[];
    shippingTerms: string[];
    paymentTerms: string[];
    factoryOrDistributorStatus: string;
  } | null;
  buyerProfile?: {
    buyerType: string;
    purchasingCategories: string[];
    preferredSupplierType: string;
    targetOrderSize: string;
    monthlyImportVolume: string;
    importExperience: string;
    purchaseTimeline: string;
    salesChannels: string[];
  } | null;
  _count?: { products: number };
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
  isTrade82Team?: boolean;
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
  const { t } = useI18n();
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
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6">
        <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-5 sm:flex-row">
          <CompanyLogo
            companyName={company.tradeName || company.legalName}
            logoUrl={company.logoThumbnailUrl ?? company.logoUrl ?? company.logoOriginalUrl ?? undefined}
            logoUrls={[
              company.logoThumbnailUrl ?? "",
              company.logoUrl ?? "",
              company.logoOriginalUrl ?? "",
            ]}
            useDefaultLogo={company.useDefaultLogo}
            size="lg"
            shape="circle"
          />
          <div className="min-w-0">
            <VerificationBadge status={company.verificationStatus} subject={company.companyRole} />
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">{company.tradeName || company.legalName}</h1>
              {company.isTrade82Team ? <AdminBadge /> : null}
            </div>
            <p className="mt-2 break-words text-sm text-zinc-500">{company.city}, {company.country}</p>
            <p className="mt-4 max-w-3xl break-words leading-7 text-zinc-600">{company.description}</p>
          </div>
        </section>
        {company.companyRole === "buyer" ? (
          <BuyerProfileDetail company={company} />
        ) : (
          <SellerProfileDetail company={company} />
        )}
        <section>
          <h2 className="text-lg font-semibold text-zinc-950">{t("company.completedDealReviews")}</h2>
          <p className="mt-1 text-sm text-zinc-500">{average.toFixed(1)}/5 · {company.reviewsReceived.length}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {company.reviewsReceived.map((review) => <ReviewCard key={review.id} review={review} />)}
          </div>
        </section>
        <CompanyReviewsSection companyId={company.id} companyRole={company.companyRole} />
        {companyProducts.length ? <section className="min-w-0"><h2 className="mb-4 text-lg font-semibold text-zinc-950">Products</h2><div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">{companyProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div></section> : null}
      </div>
    </div>
  );
}

function BuyerProfileDetail({ company }: { company: PublicCompany }) {
  const { locale, t } = useI18n();
  const profile = company.buyerProfile;
  const location = formatCompanyLocation(company, locale);
  const contactPerson = [company.owner?.displayName, company.owner?.jobTitle]
    .filter(Boolean)
    .join(" · ");
  const categoryLabels = optionLabels(profile?.purchasingCategories, buyerCategoryLabel, locale);
  const salesChannelLabels = optionLabels(profile?.salesChannels, salesChannelLabel, locale);
  const rows = compactRows([
    { label: t("settings.legalName"), value: company.tradeName || company.legalName },
    { label: t("settings.city"), value: location },
    { label: t("settings.buyerType"), value: buyerTypeOptionLabel(profile?.buyerType, locale) },
    { label: t("settings.purchasingCategories"), value: joinList(categoryLabels) },
    {
      label: t("onboarding.preferredSupplierType"),
      value: buyerSupplierTypeLabel(profile?.preferredSupplierType, locale),
    },
    { label: t("settings.targetOrderSize"), value: orderSizeLabel(profile?.targetOrderSize, locale) },
    { label: t("settings.monthlyImportVolume"), value: importVolumeLabel(profile?.monthlyImportVolume, locale) },
    { label: t("settings.importExperience"), value: importExperienceLabel(profile?.importExperience, locale) },
    { label: t("settings.purchaseTimeline"), value: sourcingTimelineLabel(profile?.purchaseTimeline, locale) },
    { label: t("settings.salesChannels"), value: joinList(salesChannelLabels) },
    { label: t("settings.contactPersonSection"), value: contactPerson },
  ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        {rows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("buyer.requirements")}</h2>
            <DetailTable rows={rows} />
          </div>
        ) : null}
        {company.description.trim() ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">{t("buyer.marketStrategy")}</h2>
            <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{company.description}</p>
          </div>
        ) : null}
      </div>
      <aside className="grid h-fit gap-5">
        {categoryLabels.length ? (
          <BadgeList title={t("buyer.interestedCategories")} values={categoryLabels} tone="blue" />
        ) : null}
        {salesChannelLabels.length ? (
          <BadgeList title={t("buyer.salesChannels")} values={salesChannelLabels} />
        ) : null}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-950">{t("buyer.sellerGuidance")}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">{t("buyer.sellerGuidanceText")}</p>
        </div>
      </aside>
    </section>
  );
}

function SellerProfileDetail({ company }: { company: PublicCompany }) {
  const { locale, t } = useI18n();
  const profile = company.sellerProfile;
  const location = formatCompanyLocation(company, locale);
  const companyRows = compactRows([
    { label: t("settings.legalName"), value: company.tradeName || company.legalName },
    { label: t("settings.city"), value: location },
    { label: t("settings.supplierType"), value: sellerSupplierTypeLabel(profile?.factoryOrDistributorStatus, locale) },
    { label: t("settings.representativeName"), value: profile?.representativeName },
    { label: t("settings.website"), value: company.website },
  ]);
  const capabilityRows = compactRows([
    { label: t("settings.productCategories"), value: joinList(profile?.productCategories.length ? profile.productCategories : company.categories) },
    { label: t("settings.exportCountries"), value: joinList(profile?.exportCountries) },
    { label: t("settings.exportExperience"), value: profile?.exportExperience },
    { label: t("settings.minimumOrderQuantity"), value: profile?.minimumOrderQuantity },
    { label: t("settings.leadTime"), value: profile?.leadTime },
    { label: t("settings.certifications"), value: joinList(profile?.certifications) },
    { label: t("settings.shippingTerms"), value: joinList(profile?.shippingTerms) },
    { label: t("settings.paymentTerms"), value: joinList(profile?.paymentTerms) },
  ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        {companyRows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("company.profile")}</h2>
            <DetailTable rows={companyRows} />
          </div>
        ) : null}
        {company.description.trim() ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">{t("company.about")}</h2>
            <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{company.description}</p>
          </div>
        ) : null}
        {capabilityRows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("company.capabilities")}</h2>
            <DetailTable rows={capabilityRows} />
          </div>
        ) : null}
      </div>
      <aside className="grid h-fit gap-5">
        {profile?.productCategories.length || company.categories.length ? (
          <BadgeList title={t("company.productCategories")} values={profile?.productCategories.length ? profile.productCategories : company.categories} tone="blue" />
        ) : null}
        {profile?.certifications.length ? (
          <BadgeList title={t("company.certifications")} values={profile.certifications} tone="green" />
        ) : null}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-950">{t("company.tradeNote")}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">{t("company.tradeNoteText")}</p>
        </div>
      </aside>
    </section>
  );
}

function BadgeList({
  title,
  values,
  tone,
}: {
  title: string;
  values: string[];
  tone?: "blue" | "green";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} tone={tone}>
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function DatabaseProductDetail({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { context: userContext, isSignedIn } = useUserContext();
  const [ownerActionPending, setOwnerActionPending] = useState(false);
  const [ownerNotice, setOwnerNotice] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const { payload, loaded } = usePublicMarketplace();
  const raw = payload.products.find((item) => item.id === id);
  const product = raw ? publicProductToCard(raw) : null;
  const sellerCompanyRef = raw?.sellerCompany as Record<string, unknown> | undefined;
  const sellerCompanyId = String(sellerCompanyRef?.id ?? "");
  const sellerCompany = payload.companies.find((item) => item.id === sellerCompanyId);
  const sellerProfile =
    (sellerCompany?.sellerProfile ?? sellerCompanyRef?.sellerProfile ?? {}) as Record<string, unknown>;
  const relatedProducts = payload.products
    .filter((item) => {
      const company = (item.sellerCompany ?? {}) as Record<string, unknown>;
      return String(company.id ?? "") === sellerCompanyId && String(item.id) !== id;
    })
    .map(publicProductToCard)
    .slice(0, 3);
  if (!loaded) return <PublicLoading />;
  if (!product) return <PublicUnavailable />;

  const richRows = raw ?? {};
  const notProvided = t("productDetail.notProvided");
  const shippingOrigin = formatShippingOrigin(richRows, sellerCompanyRef, locale, notProvided);
  const countryOfOrigin =
    countryLabel(String(richRows.countryOfOrigin ?? SOUTH_KOREA), locale) || notProvided;
  const incoterms = optionLabels(arrayOfStrings(richRows.incoterms), incotermLabel, locale);
  const documents = optionLabels(arrayOfStrings(richRows.documentsAvailable), sellerDocumentLabel, locale);
  const compliance = optionLabels(arrayOfStrings(richRows.complianceClaims), complianceClaimLabel, locale);
  const suggestedChannels = optionLabels(arrayOfStrings(richRows.suggestedUsChannels), salesChannelLabel, locale);
  const categories = arrayOfStrings(sellerCompanyRef?.categories ?? sellerCompany?.categories);
  const reviews = sellerCompany?.reviewsReceived ?? [];
  const isOwner = Boolean(
    sellerCompanyId &&
      userContext?.companies.some(
        (company) => company.id === sellerCompanyId && company.companyRole === "seller",
      ),
  );
  const canViewSensitiveFields = isOwner || Boolean(userContext?.isAdmin);
  const fieldVisibility = normalizeProductFieldVisibility(richRows.fieldVisibility);
  const displayField = createProductFieldDisplay({
    canViewSensitiveFields,
    fieldVisibility,
    locale,
    notProvided,
    t,
  });
  const price = displayField(
    "minimumUnitPrice",
    formatProductPrice(richRows, locale, notProvided),
    "price",
  );
  const moq = displayField(
    "moq",
    formatProductMoq(richRows, locale, product.moq || notProvided),
    "moq",
  );
  const leadTime = displayField(
    "leadTime",
    leadTimeLabel(String(richRows.leadTimeCode ?? richRows.leadTime ?? ""), locale) ||
      product.leadTime ||
      notProvided,
  );
  const monthlyCapacity = displayField(
    "monthlySupplyCapacity",
    formatQuantityWithUnit(
      richRows.monthlyCapacity,
      richRows.monthlyCapacityUnit,
      locale,
      notProvided,
    ),
  );
  const requestableHiddenFields = productFieldVisibilityKeys.filter(
    (key) => !canViewSensitiveFields && fieldVisibility[key] === "inquiry_required",
  );
  const checkingOwner = Boolean(isSignedIn && !userContext);

  async function setProductPreparing() {
    setOwnerActionPending(true);
    setOwnerNotice("");
    setOwnerError("");
    try {
      const response = await fetch(`/api/account/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setOwnerError(result?.error ?? t("dashboard.productUpdateFailed"));
        return;
      }
      setOwnerNotice(t("dashboard.productSetPreparing"));
    } catch {
      setOwnerError(t("dashboard.productUpdateFailed"));
    } finally {
      setOwnerActionPending(false);
    }
  }

  async function deleteProduct() {
    if (!window.confirm(t("dashboard.deleteProductConfirm"))) return;

    setOwnerActionPending(true);
    setOwnerNotice("");
    setOwnerError("");
    try {
      const response = await fetch(`/api/account/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setOwnerError(result?.error ?? t("dashboard.productDeleteFailed"));
        return;
      }
      router.push(withLocale("/dashboard/seller?section=products", locale));
    } catch {
      setOwnerError(t("dashboard.productDeleteFailed"));
    } finally {
      setOwnerActionPending(false);
    }
  }

  return (
    <div className="bg-zinc-50">
      <ViewTracker id={id} type="product" />
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <ProductImageGallery
            images={product.imageUrls?.length ? product.imageUrls : [product.imagePlaceholder]}
            productName={product.name}
          />
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div className="min-w-0">
              <VerificationBadge status={product.verificationStatus ?? "verified"} subject="seller" />
              <p className="mt-5 break-words text-sm font-medium text-blue-700">{product.category}</p>
              <h1 className="mt-2 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">{product.name}</h1>
              <p className="mt-4 max-w-2xl break-words text-base leading-7 text-zinc-600">
                {product.shortDescription || product.longDescription}
              </p>
              <div className="mt-5 flex min-w-0 items-center gap-3 text-sm text-zinc-600">
                <CompanyLogo
                  companyName={product.sellerName}
                  logoUrl={product.sellerLogoUrl}
                  useDefaultLogo={product.sellerUseDefaultLogo ?? true}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5 break-words font-semibold text-zinc-950">
                    <span>{product.sellerName}</span>
                    {product.sellerIsTrade82Team ? <AdminBadge compact /> : null}
                  </p>
                  <p className="break-words">{product.sellerLocation}</p>
                </div>
              </div>
            </div>
            {isOwner ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={withLocale("/dashboard/seller?section=products", locale)}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    {t("settings.editProduct")}
                  </Link>
                  <button
                    type="button"
                    disabled={ownerActionPending}
                    onClick={() => void setProductPreparing()}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-amber-200 px-2.5 text-xs font-medium text-amber-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {ownerActionPending ? t("settings.saving") : t("dashboard.setPreparing")}
                  </button>
                  <button
                    type="button"
                    disabled={ownerActionPending}
                    onClick={() => void deleteProduct()}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {ownerActionPending ? t("settings.saving") : t("settings.deleteProduct")}
                  </button>
                </div>
                {ownerNotice ? (
                  <p role="status" className="text-sm font-medium text-emerald-700">
                    {ownerNotice}
                  </p>
                ) : null}
                {ownerError ? (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {ownerError}
                  </p>
                ) : null}
              </div>
            ) : checkingOwner ? (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                {t("common.loading")}
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <SaveButton id={product.id} kind="product" />
                <ContactModal context={{ type: "product", product }} buttonLabel={t("productDetail.contactSeller")} />
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            [t("productDetail.wholesalePrice"), price],
            [t("marketplace.moq"), moq],
            [t("settings.leadTime"), leadTime],
            [t("productDetail.monthlyCapacity"), monthlyCapacity],
            [
              t("productDetail.sampleAvailability"),
              displayField(
                "sampleAvailability",
                sampleAvailabilityLabel(String(richRows.sampleAvailability ?? ""), locale) ||
                  notProvided,
              ),
            ],
            [t("productDetail.shippingOrigin"), shippingOrigin],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-2 break-words text-lg font-semibold text-zinc-950">{value}</p>
            </div>
          ))}
        </section>
        {requestableHiddenFields.length ? (
          <section className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-blue-900">
              {t("productDetail.hiddenFieldsHelp")}
            </p>
            <ContactModal
              context={{ type: "product", product }}
              buttonLabel={t("productDetail.requestDetails")}
            />
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-zinc-950">{t("productDetail.overview")}</h2>
              <p className="mt-3 break-words text-sm leading-6 text-zinc-600">
                {product.longDescription || notProvided}
              </p>
              {String(richRows.buyerNotes ?? "").trim() ? (
                <p className="mt-4 break-words text-sm leading-6 text-zinc-600">
                  {String(richRows.buyerNotes)}
                </p>
              ) : null}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("productDetail.tradeDetails")}</h2>
              <DetailTable
                rows={compactRows([
                  { label: t("productDetail.wholesalePrice"), value: price },
                  { label: t("marketplace.moq"), value: moq },
                  { label: t("settings.leadTime"), value: leadTime },
                  { label: t("productDetail.monthlyCapacity"), value: monthlyCapacity },
                  {
                    label: t("productDetail.privateLabel"),
                    value:
                      displayField(
                        "privateLabelAvailability",
                        privateLabelAvailabilityLabel(
                          String(richRows.privateLabelAvailability ?? ""),
                          locale,
                        ) || notProvided,
                      ),
                  },
                  { label: t("productDetail.countryOfOrigin"), value: countryOfOrigin },
                  { label: t("productDetail.shippingOrigin"), value: shippingOrigin },
                  { label: t("productDetail.incoterms"), value: displayField("incoterms", joinList(incoterms) || notProvided) },
                  { label: t("productDetail.hsCode"), value: displayField("hsCode", String(richRows.hsCode ?? "") || notProvided) },
                  { label: t("productDetail.shelfLife"), value: displayField("shelfLife", String(richRows.shelfLife ?? "") || notProvided) },
                ])}
              />
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">
                {t("productDetail.complianceDocuments")}
              </h2>
              <DetailTable
                rows={compactRows([
                  { label: t("productDetail.documents"), value: displayField("documents", joinList(documents) || notProvided, "documents") },
                  { label: t("productDetail.compliance"), value: displayField("complianceInfo", joinList(compliance) || notProvided) },
                  { label: t("settings.ingredientsMaterials"), value: displayField("ingredientsMaterials", String(richRows.ingredientsOrMaterials ?? "") || notProvided) },
                ])}
              />
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {t("productDetail.sellerProvidedNotice")}
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">
                {t("productDetail.packagingLogistics")}
              </h2>
              <DetailTable
                rows={compactRows([
                  { label: t("productDetail.packageSize"), value: displayField("packageSize", String(richRows.packageSize ?? "") || notProvided) },
                  { label: t("productDetail.unitsPerCarton"), value: displayField("unitsPerCarton", String(richRows.unitsPerCarton ?? "") || notProvided) },
                  { label: t("productDetail.cartonWeight"), value: displayField("cartonWeight", String(richRows.cartonWeight ?? "") || notProvided) },
                  { label: t("productDetail.cartonDimensions"), value: displayField("cartonDimensions", String(richRows.cartonDimensions ?? "") || notProvided) },
                  { label: t("productDetail.storageRequirements"), value: displayField("storageRequirements", String(richRows.storageRequirements ?? "") || notProvided) },
                  { label: t("productForm.storageTemperature"), value: displayField("storageTemperature", String(richRows.storageTemperature ?? "") || notProvided) },
                  { label: t("settings.packaging"), value: displayField("packaging", String(richRows.packaging ?? "") || notProvided) },
                  { label: t("productForm.palletQuantity"), value: displayField("palletQuantity", String(richRows.palletQuantity ?? "") || notProvided) },
                  { label: t("productDetail.suggestedUsChannels"), value: joinList(suggestedChannels) || notProvided },
                ])}
              />
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("productDetail.buyerReviews")}</h2>
              {reviews.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
                  {t("productDetail.noReviewsYet")}
                </div>
              )}
            </div>
          </div>

          <aside className="grid h-fit gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <CompanyLogo
                  companyName={product.sellerName}
                  logoUrl={product.sellerLogoUrl}
                  useDefaultLogo={product.sellerUseDefaultLogo ?? true}
                  size="sm"
                />
                <h2 className="text-lg font-semibold text-zinc-950">{t("productDetail.sellerInformation")}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {String(sellerCompanyRef?.description ?? sellerCompany?.description ?? "") || product.sellerName}
              </p>
              <DetailTable
                rows={compactRows([
                  { label: t("contact.company"), value: product.sellerName },
                  {
                    label: t("productDetail.supplierType"),
                    value: sellerSupplierTypeLabel(
                      String(sellerProfile.factoryOrDistributorStatus ?? ""),
                      locale,
                    ) || notProvided,
                  },
                  { label: t("productDetail.cityRegion"), value: product.sellerLocation || notProvided },
                  { label: t("productDetail.categories"), value: joinList(categories) || notProvided },
                ])}
              />
              {sellerCompanyId ? (
                <Link
                  href={withLocale(`/companies/${sellerCompanyId}`, locale)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
                >
                  {t("productDetail.viewCompanyProfile")}
                </Link>
              ) : null}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">{t("productDetail.importReviewReminder")}</h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                {t("productDetail.importReminderText")}
              </p>
            </div>
          </aside>
        </section>

        {relatedProducts.length ? (
          <section className="grid gap-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              {t("productDetail.moreFromSeller")}
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

function ReviewCard({ review }: { review: PublicCompany["reviewsReceived"][number] }) {
  return <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5"><div className="flex min-w-0 flex-wrap gap-2"><Badge tone="green">Completed Deal Review</Badge><Badge tone="blue">{review.rating}/5</Badge></div><p className="mt-4 break-words text-sm leading-6 text-zinc-700">{review.reviewText}</p><p className="mt-3 break-words text-xs text-zinc-500">{review.reviewerCompany.tradeName || review.reviewerCompany.legalName} · {formatContract(review)}</p></article>;
}

function compactRows(
  rows: Array<{ label: string; value: string | number | null | undefined }>,
) {
  return rows
    .map((row) => ({
      label: row.label,
      value: typeof row.value === "string" ? row.value.trim() : row.value,
    }))
    .filter((row) => {
      return Boolean(String(row.value ?? "").trim());
    }) as Array<{ label: string; value: string | number }>;
}

function joinList(values: string[] | undefined) {
  return values?.filter(Boolean).join(", ") ?? "";
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatProductPrice(
  product: Record<string, unknown>,
  locale: "en" | "ko",
  fallback: string,
) {
  const priceMin = product.priceMin ? Number(product.priceMin) : 0;
  const priceMax = product.priceMax ? Number(product.priceMax) : 0;
  if (!priceMin) return fallback;
  const currency = String(product.currency ?? "USD");
  const unit = priceUnitLabel(String(product.priceUnit ?? "unit"), locale);
  const range = priceMax && priceMax !== priceMin
    ? `${priceMin}-${priceMax}`
    : String(priceMin);
  return unit ? `${currency} ${range} / ${unit}` : `${currency} ${range}`;
}

function formatProductMoq(
  product: Record<string, unknown>,
  locale: "en" | "ko",
  fallback: string,
) {
  const quantity = String(product.moqQuantity ?? "").trim();
  const unit = moqUnitLabel(String(product.moqUnit ?? ""), locale);
  if (quantity && unit) return `${quantity} ${unit}`;
  const moq = String(product.moq ?? "").trim();
  return moq || fallback;
}

function formatQuantityWithUnit(
  quantityValue: unknown,
  unitValue: unknown,
  locale: "en" | "ko",
  fallback: string,
) {
  const quantity = String(quantityValue ?? "").trim();
  if (!quantity) return fallback;
  const unit = priceUnitLabel(String(unitValue ?? "unit"), locale);
  return unit ? `${quantity} ${unit}` : quantity;
}

function formatShippingOrigin(
  product: Record<string, unknown>,
  company: Record<string, unknown> | undefined,
  locale: "en" | "ko",
  fallback: string,
) {
  const region = String(product.shippingOriginRegion ?? company?.city ?? "");
  const country = String(product.shippingOriginCountry ?? company?.country ?? SOUTH_KOREA);
  const regionLabel = country === SOUTH_KOREA ? koreanRegionLabel(region, locale) : region;
  const countryText = countryLabel(country, locale);
  return [regionLabel, countryText].filter(Boolean).join(", ") || fallback;
}

function formatCompanyLocation(
  company: Pick<PublicCompany, "country" | "city" | "stateOrProvince">,
  locale: "en" | "ko",
) {
  const city =
    company.country === SOUTH_KOREA
      ? koreanRegionLabel(company.city, locale)
      : company.city;
  const state =
    company.country === UNITED_STATES
      ? stateLabel(company.stateOrProvince, locale)
      : company.stateOrProvince;

  return [city, state, countryLabel(company.country, locale)]
    .filter(Boolean)
    .join(", ");
}

function formatContract(review: PublicCompany["reviewsReceived"][number]) {
  if (review.publicValueDisplay === "hidden") return "Contract value hidden";
  const value = Number(review.contractValue);
  if (review.publicValueDisplay === "exact") return `${review.currency} ${value.toLocaleString("en-US")}`;
  if (value < 50000) return "$10k-$50k";
  if (value < 100000) return "$50k-$100k";
  if (value < 500000) return "$100k-$500k";
  return "$500k+";
}

function createProductFieldDisplay({
  canViewSensitiveFields,
  fieldVisibility,
  locale,
  notProvided,
  t,
}: {
  canViewSensitiveFields: boolean;
  fieldVisibility: ProductFieldVisibility;
  locale: "en" | "ko";
  notProvided: string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    key: ProductFieldVisibilityKey,
    value: string,
    placeholderType: "default" | "price" | "moq" | "documents" = "default",
  ) => {
    const visibility = fieldVisibility[key];
    const cleanValue = value.trim() || notProvided;
    if (canViewSensitiveFields) {
      return `${cleanValue} · ${visibilityLabel(visibility, locale, t)}`;
    }
    if (visibility === "public") return cleanValue;
    if (visibility === "private") return t("productDetail.privateFieldHidden");
    if (placeholderType === "price") return t("productDetail.priceAvailableUponInquiry");
    if (placeholderType === "moq") return t("productDetail.moqAvailableUponInquiry");
    if (placeholderType === "documents") return t("productDetail.documentsAvailableUponRequest");
    return t("productDetail.availableUponInquiry");
  };
}

function visibilityLabel(
  visibility: ProductFieldVisibilityLevel,
  locale: "en" | "ko",
  t: ReturnType<typeof useI18n>["t"],
) {
  void locale;
  if (visibility === "public") return t("productDetail.visibilityPublic");
  if (visibility === "private") return t("productDetail.visibilityPrivate");
  return t("productDetail.visibilityInquiryRequired");
}

function publicProductToCard(value: Record<string, unknown>): Product {
  const company = (value.sellerCompany ?? {}) as Record<string, unknown>;
  const images = Array.isArray(value.images)
    ? (value.images as Array<Record<string, unknown>>)
    : [];
  const imageUrls = images.map(productImageUrl).filter((url) => url !== null);
  const fallbackImageUrl =
    typeof value.imageUrl === "string" && value.imageUrl.trim()
      ? value.imageUrl.trim()
      : "";
  const priceMin = value.priceMin ? Number(value.priceMin) : 0;
  const priceMax = value.priceMax ? Number(value.priceMax) : priceMin;
  const fieldVisibility = normalizeProductFieldVisibility(value.fieldVisibility);
  const moqQuantity = String(value.moqQuantity ?? "").trim();
  const moq = moqQuantity && value.moqUnit
    ? `${moqQuantity} ${String(value.moqUnit)}`
    : String(value.moq ?? "");
  return {
    id: String(value.id),
    name: String(value.name),
    category: value.category as Product["category"],
    sellerId: String(company.id),
    sellerName: String(company.tradeName ?? company.legalName ?? ""),
    sellerLocation: [company.city, company.country].filter(Boolean).join(", "),
    sellerLogoUrl:
      typeof company.logoThumbnailUrl === "string"
        ? company.logoThumbnailUrl
        : typeof company.logoUrl === "string"
          ? company.logoUrl
          : typeof company.logoOriginalUrl === "string"
            ? company.logoOriginalUrl
            : undefined,
    sellerUseDefaultLogo: company.useDefaultLogo !== false,
    sellerIsTrade82Team: company.isTrade82Team === true,
    shortDescription: String(value.shortDescription ?? ""),
    longDescription: String(value.detailedDescription ?? ""),
    wholesalePrice: priceMin
      ? `${String(value.currency ?? "USD")} ${priceMin}${priceMax !== priceMin ? `-${priceMax}` : ""}`
      : fieldVisibility.minimumUnitPrice === "private"
        ? "Private to seller"
        : "Price available upon inquiry",
    wholesalePriceValue: priceMin,
    moq:
      moq ||
      (fieldVisibility.moq === "private"
        ? "Private to seller"
        : "MOQ available upon inquiry"),
    moqUnits: Number(moq.replace(/\D/g, "")) || 0,
    leadTime: String(value.leadTime ?? ""),
    monthlyCapacity: String(value.monthlyCapacity ?? ""),
    sampleAvailable:
      value.sampleAvailability === "samples_available" ||
      value.sampleAvailability === "paid_samples_available",
    privateLabelAvailable: value.privateLabelAvailability === "available",
    countryOfOrigin: String(value.countryOfOrigin ?? "South Korea"),
    shippingOrigin: [value.shippingOriginRegion, value.shippingOriginCountry ?? company.country]
      .filter(Boolean)
      .join(", "),
    incoterms: arrayOfStrings(value.incoterms),
    hsCode: String(value.hsCode ?? ""),
    certifications: arrayOfStrings(value.complianceClaims ?? value.certifications),
    documentsAvailable: arrayOfStrings(value.documentsAvailable),
    shelfLife: String(value.shelfLife ?? ""),
    packageSize: String(value.packageSize ?? value.packaging ?? ""),
    unitsPerCarton: String(value.unitsPerCarton ?? ""),
    cartonWeight: String(value.cartonWeight ?? ""),
    koreanMarketFit: String(value.buyerNotes ?? value.ingredientsOrMaterials ?? ""),
    suggestedSalesChannels: arrayOfStrings(value.suggestedUsChannels),
    riskNotes: arrayOfStrings(value.riskNotes),
    imagePlaceholder: imageUrls[0] ?? fallbackImageUrl,
    imageUrls,
    tags: arrayOfStrings(value.tags),
    createdAt: String(value.createdAt ?? new Date().toISOString()),
    verificationStatus: String(company.verificationStatus ?? "verified") as VerificationStatus,
  };
}

function productImageUrl(image: Record<string, unknown>) {
  const value = image.detailUrl ?? image.mainUrl ?? image.cardUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function PublicLoading() { return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-600">Loading...</div>; }
function PublicUnavailable() { return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-zinc-600">This listing is unavailable.</div>; }
