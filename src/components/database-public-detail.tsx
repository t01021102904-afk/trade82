"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AdminBadge } from "@/components/admin-badge";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/badge";
import { CompanyReviewsSection } from "@/components/company-reviews";
import { ContactModal } from "@/components/contact-modal";
import { CountryFlag } from "@/components/country-flag";
import { DetailTable } from "@/components/detail-table";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { ProductInquiryComposer } from "@/components/product-inquiry-composer";
import { ProductShareButton } from "@/components/product-share-button";
import { ViewTracker } from "@/components/view-tracker";
import { SaveButton } from "@/components/save-button";
import { WholesalePriceGate } from "@/components/wholesale-price-gate";
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
  sellerDocumentLabel,
  sellerSupplierTypeLabel,
  sourcingTimelineLabel,
  stateLabel,
  supplierTypeLabel as buyerSupplierTypeLabel,
  SOUTH_KOREA,
  UNITED_STATES,
} from "@/lib/company-select-options";
import { localizedCountryLabel } from "@/lib/country-normalization";
import { withLocale } from "@/lib/i18n";
import {
  localizedArray,
  localizedCompanyDescription,
  localizedCompanyName,
  localizedSellerExportExperience,
  localizedText,
} from "@/lib/multilingual-content";
import {
  normalizeProductFieldVisibility,
  type ProductFieldVisibility,
  type ProductFieldVisibilityKey,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";
import { databaseCompanyToSeller } from "@/lib/public-marketplace-presenters";
import { formatProductPrice as formatPrice } from "@/lib/product-price-display";
import type { Product, VerificationStatus } from "@/lib/types";

type PublicCompany = {
  id: string;
  companyRole: "seller" | "buyer";
  legalName: string;
  tradeName: string | null;
  displayNameEn: string;
  logoOriginalUrl: string | null;
  logoThumbnailUrl: string | null;
  logoUrl: string | null;
  useDefaultLogo: boolean;
  country: string;
  city: string;
  stateOrProvince: string;
  website: string;
  description: string;
  descriptionEn: string;
  categories: string[];
  verificationStatus: VerificationStatus;
  owner?: {
    displayName: string;
    jobTitle: string;
  };
  sellerProfile?: {
    representativeName: string;
    exportExperience: string;
    exportExperienceEn: string;
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
    reviewTitle: string | null;
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
  const { locale, t } = useI18n();
  const { payload, loaded } = usePublicMarketplace();
  const company = payload.companies.find((item) => item.id === id);
  const companyProducts = payload.products
    .filter((item) => (item.sellerCompany as { id?: string })?.id === id)
    .map((item) => publicProductToCard(item, locale));

  if (!loaded) return <PublicLoading />;
  if (!company) return <PublicUnavailable />;
  const companyName = localizedCompanyName(company, locale);
  const companyDescription = localizedCompanyDescription(company, locale);
  const seller =
    company.companyRole === "seller"
      ? databaseCompanyToSeller(
          company as unknown as Record<string, unknown>,
          locale,
        )
      : null;
  return (
    <div className="bg-white">
      <ViewTracker id={company.id} type="company" />
      <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-6 sm:px-5 lg:px-6">
        <BackButton
          fallbackHref={company.companyRole === "buyer" ? "/buyers" : "/sellers"}
        />
        <section className="grid min-w-0 gap-5 border-y border-zinc-200 py-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
          <CompanyLogo
            companyName={companyName}
            logoUrl={company.logoThumbnailUrl ?? company.logoUrl ?? company.logoOriginalUrl ?? undefined}
            logoUrls={[
              company.logoThumbnailUrl ?? "",
              company.logoUrl ?? "",
              company.logoOriginalUrl ?? "",
            ]}
            useDefaultLogo={company.useDefaultLogo}
            size="lg"
            shape="square"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="break-words text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">{companyName}</h1>
              {company.isTrade82Team ? <AdminBadge /> : null}
            </div>
            <p className="mt-2 break-words text-sm text-zinc-500">{company.city}, {company.country}</p>
            <p className="mt-4 max-w-3xl break-words text-sm leading-6 text-zinc-600 sm:text-base">{companyDescription}</p>
          </div>
          </div>
          {seller ? (
            <div className="grid gap-3">
              <ContactModal
                context={{ type: "seller", seller }}
                buttonLabel={t("common.contactCompany")}
                className="min-h-10 w-full bg-zinc-950 font-semibold hover:bg-zinc-800"
              />
              <p className="text-xs leading-5 text-zinc-500">
                {t("company.contactGuidance")}
              </p>
            </div>
          ) : null}
        </section>
        {company.companyRole === "buyer" ? (
          <BuyerProfileDetail company={company} />
        ) : (
          <SellerProfileDetail company={company} />
        )}
        {company.reviewsReceived.length ? (
          <>
            <section>
              <h2 className="text-lg font-semibold text-zinc-950">{t("company.completedDealFeedback")}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {company.reviewsReceived.map((review) => <ReviewCard key={review.id} review={review} />)}
              </div>
            </section>
            <CompanyReviewsSection companyId={company.id} companyRole={company.companyRole} />
          </>
        ) : null}
        {companyProducts.length ? (
          <section className="min-w-0 border-t border-zinc-200 pt-6">
            <h2 className="mb-4 text-xl font-semibold tracking-[-0.03em] text-zinc-950">
              {t("company.products")}
            </h2>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {companyProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function BuyerProfileDetail({ company }: { company: PublicCompany }) {
  const { locale, t } = useI18n();
  const profile = company.buyerProfile;
  const companyName = localizedCompanyName(company, locale);
  const companyDescription = localizedCompanyDescription(company, locale);
  const location = formatCompanyLocation(company, locale);
  const contactPerson = [company.owner?.displayName, company.owner?.jobTitle]
    .filter(Boolean)
    .join(" · ");
  const categoryLabels = optionLabels(profile?.purchasingCategories, buyerCategoryLabel, locale);
  const salesChannelLabels = optionLabels(profile?.salesChannels, salesChannelLabel, locale);
  const rows = compactRows([
    { label: t("settings.legalName"), value: companyName },
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
    <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5">
        {rows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("buyer.requirements")}</h2>
            <DetailTable rows={rows} />
          </div>
        ) : null}
        {companyDescription.trim() ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-zinc-950">{t("buyer.marketStrategy")}</h2>
            <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{companyDescription}</p>
          </div>
        ) : null}
      </div>
      <aside className="grid h-fit gap-4">
        {categoryLabels.length ? (
          <BadgeList title={t("buyer.interestedCategories")} values={categoryLabels} />
        ) : null}
        {salesChannelLabels.length ? (
          <BadgeList title={t("buyer.salesChannels")} values={salesChannelLabels} />
        ) : null}
        <div className="rounded-lg border border-[#34B386]/40 bg-[#34B386]/10 p-4">
          <h2 className="font-semibold text-zinc-950">{t("buyer.sellerGuidance")}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{t("buyer.sellerGuidanceText")}</p>
        </div>
      </aside>
    </section>
  );
}

function SellerProfileDetail({ company }: { company: PublicCompany }) {
  const { locale, t } = useI18n();
  const profile = company.sellerProfile;
  const companyName = localizedCompanyName(company, locale);
  const companyDescription = localizedCompanyDescription(company, locale);
  const location = formatCompanyLocation(company, locale);
  const companyRows = compactRows([
    { label: t("settings.legalName"), value: companyName },
    { label: t("settings.city"), value: location },
    { label: t("settings.supplierType"), value: sellerSupplierTypeLabel(profile?.factoryOrDistributorStatus, locale) },
    { label: t("settings.representativeName"), value: profile?.representativeName },
    { label: t("settings.website"), value: company.website },
  ]);
  const capabilityRows = compactRows([
    { label: t("settings.productCategories"), value: joinList(profile?.productCategories.length ? profile.productCategories : company.categories) },
    { label: t("settings.exportExperience"), value: localizedSellerExportExperience(profile, locale) },
    { label: t("settings.minimumOrderQuantity"), value: profile?.minimumOrderQuantity },
    { label: t("settings.leadTime"), value: profile?.leadTime },
    { label: t("settings.certifications"), value: joinList(profile?.certifications) },
    { label: t("settings.shippingTerms"), value: joinList(profile?.shippingTerms) },
    { label: t("settings.paymentTerms"), value: joinList(profile?.paymentTerms) },
  ]);
  const hasSellerSidebar = Boolean(
    profile?.productCategories.length || company.categories.length || profile?.certifications.length,
  );

  return (
    <section className={hasSellerSidebar ? "grid gap-5 lg:grid-cols-[1fr_340px]" : "grid gap-5"}>
      <div className="grid gap-5">
        {companyRows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("company.profile")}</h2>
            <DetailTable rows={companyRows} />
          </div>
        ) : null}
        {companyDescription.trim() ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-zinc-950">{t("company.about")}</h2>
            <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{companyDescription}</p>
          </div>
        ) : null}
        {capabilityRows.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("company.capabilities")}</h2>
            <DetailTable rows={capabilityRows} />
          </div>
        ) : null}
        {profile?.exportCountries.length ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-950">
              {t("company.mainExportMarkets")}
            </h2>
            <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-white p-4">
              {profile.exportCountries.map((country) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800"
                >
                  <CountryFlag country={country} size="md" />
                  {localizedCountryLabel(country, locale)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {hasSellerSidebar ? (
        <aside className="grid h-fit gap-4">
          {profile?.productCategories.length || company.categories.length ? (
            <BadgeList title={t("company.productCategories")} values={profile?.productCategories.length ? profile.productCategories : company.categories} />
          ) : null}
          {profile?.certifications.length ? (
            <BadgeList title={t("company.certifications")} values={profile.certifications} accent />
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

function BadgeList({
  title,
  values,
  accent = false,
}: {
  title: string;
  values: string[];
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge
            key={value}
            className={accent ? "border-[#34B386]/50 bg-[#34B386]/10 text-zinc-800" : undefined}
          >
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
  const localizedProducts = payload.products.map((item) =>
    publicProductToCard(item, locale),
  );
  const product = localizedProducts.find((item) => item.id === id) ?? null;
  const sellerCompanyRef = raw?.sellerCompany as Record<string, unknown> | undefined;
  const sellerCompanyId = String(sellerCompanyRef?.id ?? "");
  const sellerCompany = payload.companies.find((item) => item.id === sellerCompanyId);
  const sellerProfile =
    (sellerCompany?.sellerProfile ?? sellerCompanyRef?.sellerProfile ?? {}) as Record<string, unknown>;
  const relatedProducts = localizedProducts
    .filter((item) => item.sellerId === sellerCompanyId && item.id !== id)
    .slice(0, 4);
  const similarProducts = product
    ? selectSimilarProducts({
        currentProduct: product,
        products: localizedProducts,
        excludedIds: new Set([id, ...relatedProducts.map((item) => item.id)]),
      })
    : [];
  if (!loaded) return <PublicLoading />;
  if (!product) return <PublicUnavailable />;

  const richRows = raw ?? {};
  const buyerNotes = localizedText({
    locale,
    original: richRows.buyerNotes,
    english: richRows.buyerNotesEn,
  });
  const sellerDescription = localizedText({
    locale,
    original: sellerCompanyRef?.description ?? sellerCompany?.description,
    english: sellerCompanyRef?.descriptionEn ?? sellerCompany?.descriptionEn,
  });
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
  const priceDisplay = (
    <WholesalePriceGate
      value={price}
      valueClassName="break-words"
      gateClassName="text-sm"
    />
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
  const checkingOwner = Boolean(isSignedIn && !userContext);
  const shareImageUrl = product.imageUrls?.[0] || product.imagePlaceholder;
  const shareDescription = product.shortDescription || product.longDescription || product.name;

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
    <div className="bg-white">
      <ViewTracker id={id} type="product" />
      <div className="mx-auto grid max-w-[1240px] gap-7 px-4 py-6 sm:px-5 lg:px-6">
        <BackButton fallbackHref="/marketplace" />
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:items-start">
          <ProductImageGallery
            images={product.imageUrls?.length ? product.imageUrls : [product.imagePlaceholder]}
            productName={product.name}
          />
          <div className="sticky top-20 min-w-0 border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                {product.category}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <SaveButton id={product.id} kind="product" iconOnly />
                <ProductShareButton
                  title={product.name}
                  description={shareDescription}
                  imageUrl={shareImageUrl}
                  className="!h-auto !border-0 !bg-transparent !px-0 !py-0 !shadow-none hover:!bg-transparent"
                />
              </div>
            </div>
            <h1 className="mt-2 break-words text-2xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-zinc-600">
              {product.shortDescription || product.longDescription}
            </p>
            <dl className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200">
              {[
                { label: t("listing.retailPrice"), value: product.retailPrice ? <s>{product.retailPrice}</s> : notProvided },
                { label: t("listing.wholesalePrice"), value: <span className="text-[#34B386]">{priceDisplay}</span> },
                { label: t("marketplace.moq"), value: moq },
                { label: t("productDetail.shippingOrigin"), value: shippingOrigin },
                {
                  label: t("productDetail.incoterms"),
                  value: displayField("incoterms", joinList(incoterms) || notProvided),
                },
                {
                  label: t("productDetail.compliance"),
                  value: joinList(product.certifications) || notProvided,
                },
              ].map(({ label, value }) => (
                <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 py-3 text-sm">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="break-words text-right font-semibold text-zinc-950">{value}</dd>
                </div>
              ))}
            </dl>
            {isOwner ? (
              <div className="mt-5 grid gap-2 border-t border-border pt-5">
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={withLocale("/dashboard/seller?section=products", locale)}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white hover:bg-zinc-800"
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
                  <p role="status" className="text-sm font-medium text-zinc-700">
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
              <div className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : (
              <ProductInquiryComposer
                product={product}
                className="mt-5 border-t border-border pt-5"
              />
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-zinc-950">{t("productDetail.overview")}</h2>
              <p className="mt-3 break-words text-sm leading-6 text-zinc-600">
                {product.longDescription || notProvided}
              </p>
              {buyerNotes ? (
                <p className="mt-4 break-words text-sm leading-6 text-zinc-600">
                  {buyerNotes}
                </p>
              ) : null}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("productDetail.tradeDetails")}</h2>
              <DetailTable
                rows={compactRows([
                  { label: t("productDetail.wholesalePrice"), value: priceDisplay },
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
              <h2 className="mb-3 text-lg font-semibold text-zinc-950">{t("productDetail.buyerFeedback")}</h2>
              {reviews.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                  {t("productDetail.noReviewsYet")}
                </div>
              )}
            </div>
          </div>

          <aside className="grid h-fit gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
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
                {sellerDescription || product.sellerName}
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
                  className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-[#34B386] hover:text-zinc-950"
                >
                  {t("productDetail.viewCompanyProfile")}
                </Link>
              ) : null}
            </div>
          </aside>
        </section>

        {relatedProducts.length ? (
          <RelatedProductsSection
            title={t("productDetail.moreFromSeller")}
            products={relatedProducts}
          />
        ) : null}

        {similarProducts.length ? (
          <RelatedProductsSection
            title={t("productDetail.similarProducts")}
            subtitle={t("productDetail.similarProductsSubtitle")}
            products={similarProducts}
          />
        ) : null}
      </div>
    </div>
  );
}

function RelatedProductsSection({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle?: string;
  products: Product[];
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {products.map((item) => (
          <CompactRelatedProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}

function CompactRelatedProductCard({ product }: { product: Product }) {
  const { locale, t } = useI18n();
  const href = withLocale(`/products/${product.id}`, locale);

  return (
    <article className="group min-w-0 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm shadow-zinc-100/60">
      <div className="relative h-36 overflow-hidden rounded-md bg-zinc-50 sm:h-40 lg:h-44">
        <Link href={href} className="relative block size-full">
          <ProductImage
            urls={[product.imagePlaceholder, ...(product.imageUrls ?? [])]}
            alt={product.name}
            sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"
            className="size-full rounded-md"
            imageClassName="bg-white object-contain p-2 transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"
            showLabel={false}
          />
        </Link>
        <SaveButton
          id={product.id}
          kind="product"
          iconOnly
          className="absolute right-1.5 top-1.5 h-8 w-8"
        />
      </div>
      <div className="grid min-w-0 gap-1.5 pt-2.5">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950 transition-colors group-hover:text-[#34B386]">
            {product.name}
          </h3>
        </Link>
        <Link
          href={withLocale(`/companies/${product.sellerId}`, locale)}
          className="flex min-w-0 items-center gap-1 text-xs text-zinc-500 hover:text-[#34B386]"
        >
          <span className="truncate">{product.sellerName}</span>
          {product.sellerIsTrade82Team ? <AdminBadge compact /> : null}
        </Link>
        <WholesalePriceGate
          value={product.wholesalePrice}
          className="max-w-full"
          valueClassName="truncate text-sm font-semibold text-zinc-950"
          gateClassName="text-xs"
        />
        <p className="truncate text-xs text-zinc-500">
          {t("marketplace.moq")}: {product.moq}
        </p>
      </div>
    </article>
  );
}

function selectSimilarProducts({
  currentProduct,
  products,
  excludedIds,
}: {
  currentProduct: Product;
  products: Product[];
  excludedIds: Set<string>;
}) {
  const currentNameKeywords = keywordSet(currentProduct.name);
  const currentTagKeywords = keywordSet((currentProduct.tags ?? []).join(" "));
  const currentDescriptionKeywords = keywordSet(
    `${currentProduct.shortDescription} ${currentProduct.longDescription}`,
  );
  const selectedIds = new Set(excludedIds);

  const scored = products
    .filter((item) => item.id !== currentProduct.id && !selectedIds.has(item.id))
    .map((item) => {
      const nameOverlap = overlapCount(currentNameKeywords, keywordSet(item.name));
      const tagOverlap = overlapCount(
        currentTagKeywords,
        keywordSet((item.tags ?? []).join(" ")),
      );
      const descriptionOverlap = overlapCount(
        currentDescriptionKeywords,
        keywordSet(`${item.shortDescription} ${item.longDescription}`),
      );
      const sameCategory = item.category === currentProduct.category;
      const otherSeller = item.sellerId !== currentProduct.sellerId;
      const hasSimilarity =
        sameCategory ||
        nameOverlap > 0 ||
        tagOverlap > 0 ||
        descriptionOverlap > 0;
      const score =
        (sameCategory ? 60 : 0) +
        nameOverlap * 8 +
        tagOverlap * 10 +
        descriptionOverlap * 3 +
        (otherSeller ? 8 : 0);

      return {
        item,
        score,
        hasSimilarity,
        createdAt: sortableCreatedAt(item.createdAt),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.createdAt - left.createdAt;
    });

  const selected: Product[] = [];
  for (const match of scored) {
    if (!match.hasSimilarity || selectedIds.has(match.item.id)) continue;
    selected.push(match.item);
    selectedIds.add(match.item.id);
    if (selected.length >= 8) return selected;
  }

  for (const match of scored) {
    if (selectedIds.has(match.item.id)) continue;
    selected.push(match.item);
    selectedIds.add(match.item.id);
    if (selected.length >= 8) return selected;
  }

  return selected;
}

function keywordSet(value: string) {
  const ignored = new Set([
    "and",
    "for",
    "the",
    "with",
    "from",
    "product",
    "products",
    "상품",
    "제품",
    "세트",
  ]);

  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && !ignored.has(word)),
  );
}

function overlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const item of left) {
    if (right.has(item)) count += 1;
  }
  return count;
}

function sortableCreatedAt(value: string | undefined) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function ReviewCard({ review }: { review: PublicCompany["reviewsReceived"][number] }) {
  const { locale, t } = useI18n();
  return <article className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4"><Badge>{t("reviews.verifiedDeal")}</Badge>{review.reviewTitle ? <h3 className="mt-4 break-words text-base font-semibold text-zinc-950">{review.reviewTitle}</h3> : null}<p className="mt-4 break-words text-sm leading-6 text-zinc-700">{review.reviewText}</p><p className="mt-3 break-words text-xs text-zinc-500">{review.reviewerCompany.tradeName || review.reviewerCompany.legalName} · {formatContract(review)} · {formatFeedbackDate(review.createdAt, locale)}</p></article>;
}

function formatFeedbackDate(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function compactRows(
  rows: Array<{ label: string; value: ReactNode }>,
) {
  return rows
    .map((row) => ({
      label: row.label,
      value: typeof row.value === "string" ? row.value.trim() : row.value,
    }))
    .filter((row) => {
      if (row.value === null || row.value === undefined) return false;
      return typeof row.value === "string" ? Boolean(row.value.trim()) : true;
    });
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
  if (!priceMin) return fallback;
  const currency = String(product.currency ?? "USD");
  const unit = priceUnitLabel(String(product.priceUnit ?? "unit"), locale);
  const formatted = formatPrice(priceMin, currency);
  return unit ? `${formatted} / ${unit}` : formatted;
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

function publicProductToCard(
  value: Record<string, unknown>,
  locale: "en" | "ko" = "ko",
): Product {
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
  const priceMax = value.priceMax ? Number(value.priceMax) : 0;
  const fieldVisibility = normalizeProductFieldVisibility(value.fieldVisibility);
  const moqQuantity = String(value.moqQuantity ?? "").trim();
  const moq = moqQuantity && value.moqUnit
    ? `${moqQuantity} ${String(value.moqUnit)}`
    : String(value.moq ?? "");
  return {
    id: String(value.id),
    name: localizedText({
      locale,
      original: value.name,
      english: value.nameEn,
    }),
    category: value.category as Product["category"],
    sellerId: String(company.id),
    sellerName: localizedCompanyName(company, locale),
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
    shortDescription: localizedText({
      locale,
      original: value.shortDescription,
      english: value.shortDescriptionEn,
    }),
    longDescription: localizedText({
      locale,
      original: value.detailedDescription,
      english: value.detailedDescriptionEn,
    }),
    wholesalePrice: priceMin
      ? formatPrice(priceMin, value.currency)
      : fieldVisibility.minimumUnitPrice === "private"
        ? "Private to seller"
        : "Price available upon inquiry",
    wholesalePriceValue: priceMin,
    retailPrice: priceMax ? formatPrice(priceMax, value.currency) : undefined,
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
    koreanMarketFit: localizedText({
      locale,
      original: value.buyerNotes ?? value.ingredientsOrMaterials,
      english: value.buyerNotesEn,
    }),
    suggestedSalesChannels: arrayOfStrings(value.suggestedUsChannels),
    riskNotes: arrayOfStrings(value.riskNotes),
    imagePlaceholder: imageUrls[0] ?? fallbackImageUrl,
    imageUrls,
    tags: localizedArray({
      locale,
      original: value.tags,
      english: value.tagsEn,
    }),
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
