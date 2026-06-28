"use client";

import { useUser } from "@clerk/nextjs";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { SingleImageUploader } from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import {
  useDraftBackup,
  useUnsavedChangesWarning,
} from "@/hooks/use-form-reliability";
import {
  loadAccountCompanies,
  rememberAccountCompany,
  type AccountCompanyRecord,
} from "@/hooks/use-account-companies";
import {
  getBuyerCategoryOptions,
  getBuyerTypeOptions,
  getImportExperienceOptions,
  getImportVolumeOptions,
  getKoreanRegionOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getOrderSizeOptions,
  getSalesChannelOptions,
  getSellerProductCategoryOptions,
  getSellerSupplierTypeOptions,
  getSourcingTimelineOptions,
  getSupplierTypeOptions,
  getUsStateOptions,
  formatMoqValue,
  normalizeSellerSupplierType,
  parseMoqValue,
  SOUTH_KOREA,
  UNITED_STATES,
  type SelectOption,
} from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";
import type { UploadedListingImage } from "@/lib/marketplace";
import type {
  BuyerCompanyProfile,
  CompanyProfile,
  SellerCompanyProfile,
} from "@/lib/types";

function debugCompanyLogo(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[company-logo] ${message}`, details);
  }
}

function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joined(value: string[]) {
  return value.join(", ");
}

type LoadedCompanyProfile = {
  company: CompanyProfile;
  seller: SellerCompanyProfile;
  buyer: BuyerCompanyProfile;
};

type CompanyDraft = LoadedCompanyProfile;

type CompanyRecord = AccountCompanyRecord;

type CompanyFormErrors = Partial<
  Record<
    "legalName" | "country" | "city" | "stateOrProvince" | "businessAddress" | "website",
    string
  >
>;

function buildCompanyProfile(
  stored: CompanyRecord | undefined,
  role: "seller" | "buyer",
  userId: string,
): LoadedCompanyProfile {
  const now = new Date().toISOString();
  const companyId = String(stored?.id ?? `new-${role}`);
  const sellerProfile = (stored?.sellerProfile ?? {}) as CompanyRecord;
  const buyerProfile = (stored?.buyerProfile ?? {}) as CompanyRecord;

  return {
    company: {
      id: companyId,
      ownerClerkUserId: userId,
      companyRole: role,
      legalName: String(stored?.legalName ?? ""),
      tradeName: String(stored?.tradeName ?? ""),
      logoOriginalUrl: String(stored?.logoOriginalUrl ?? ""),
      logoThumbnailUrl: String(stored?.logoThumbnailUrl ?? ""),
      logoUrl: String(stored?.logoUrl ?? ""),
      useDefaultLogo: stored?.useDefaultLogo !== false,
      website: String(stored?.website ?? ""),
      country: role === "seller" ? SOUTH_KOREA : UNITED_STATES,
      city: String(stored?.city ?? ""),
      stateOrProvince: String(stored?.stateOrProvince ?? ""),
      businessAddress: String(stored?.businessAddress ?? ""),
      description: String(stored?.description ?? ""),
      categories: Array.isArray(stored?.categories)
        ? (stored.categories as string[])
        : [],
      verificationStatus:
        (stored?.verificationStatus as CompanyProfile["verificationStatus"]) ??
        (role === "seller" ? "pending_review" : "unverified"),
      createdAt: String(stored?.createdAt ?? now),
      updatedAt: String(stored?.updatedAt ?? now),
    },
    seller: {
      companyId,
      businessRegistrationNumber: String(
        sellerProfile.koreanBusinessRegistrationNumber ?? "",
      ),
      representativeName: String(sellerProfile.representativeName ?? ""),
      exportExperience: String(sellerProfile.exportExperience ?? ""),
      exportCountries: (sellerProfile.exportCountries as string[]) ?? [
        "United States",
      ],
      productCategories: (sellerProfile.productCategories as string[]) ?? [],
      minimumOrderQuantity: String(sellerProfile.minimumOrderQuantity ?? ""),
      leadTime: String(sellerProfile.leadTime ?? ""),
      certifications: (sellerProfile.certifications as string[]) ?? [],
      shippingTerms: (sellerProfile.shippingTerms as string[]) ?? [],
      paymentTerms: (sellerProfile.paymentTerms as string[]) ?? [],
      supplierType:
        normalizeSellerSupplierType(
          String(sellerProfile.factoryOrDistributorStatus ?? ""),
        ) || "manufacturer",
    },
    buyer: {
      companyId,
      buyerType:
        (buyerProfile.buyerType as BuyerCompanyProfile["buyerType"]) ??
        "importer",
      purchasingCategories:
        (buyerProfile.purchasingCategories as string[]) ?? [],
      preferredSupplierType: String(buyerProfile.preferredSupplierType ?? ""),
      targetOrderSize: String(buyerProfile.targetOrderSize ?? ""),
      monthlyImportVolume: String(buyerProfile.monthlyImportVolume ?? ""),
      importExperience: String(buyerProfile.importExperience ?? ""),
      salesChannels: (buyerProfile.salesChannels as string[]) ?? [],
      purchaseTimeline: String(buyerProfile.purchaseTimeline ?? ""),
    },
  };
}

async function readJsonError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return result?.error ?? fallback;
}

export function CompanyProfileSettings() {
  const { isLoaded, user } = useUser();
  const { locale, t } = useI18n();
  const metadataRole = user?.publicMetadata.role;
  const role =
    metadataRole === "seller" || metadataRole === "both"
      ? "seller"
      : metadataRole === "buyer"
        ? "buyer"
        : null;
  const userId = user?.id ?? "";
  const [loadedProfile, setLoadedProfile] =
    useState<LoadedCompanyProfile | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId || !role) return;

    let cancelled = false;
    void loadAccountCompanies(userId)
      .then((companies: CompanyRecord[]) => {
        if (cancelled) return;
        const stored = companies.find((item) => item.companyRole === role);
        debugCompanyLogo("loaded company profile", {
          role,
          companyId: stored?.id ?? null,
          logoOriginalUrl: stored?.logoOriginalUrl ?? null,
          logoThumbnailUrl: stored?.logoThumbnailUrl ?? null,
          logoUrl: stored?.logoUrl ?? null,
          useDefaultLogo: stored?.useDefaultLogo ?? null,
        });
        setLoadedProfile(buildCompanyProfile(stored, role, userId));
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, role, userId]);

  if (
    isLoaded &&
    user &&
    user.publicMetadata.role !== "seller" &&
    user.publicMetadata.role !== "buyer" &&
    user.publicMetadata.role !== "both"
  ) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6">
        <p className="text-sm text-zinc-600">
          {t("settings.companyProfileMissingText")}
        </p>
        <Link
          href={withLocale("/onboarding/role", locale)}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
        >
          {t("dashboard.startOnboarding")}
        </Link>
      </div>
    );
  }

  if (
    !isLoaded ||
    !user ||
    !role ||
    !loadedProfile ||
    loadedProfile.company.ownerClerkUserId !== user.id ||
    loadedProfile.company.companyRole !== role
  ) {
    return <div className="text-sm text-zinc-600">{t("common.loading")}</div>;
  }

  return (
    <CompanyProfileForm
      role={loadedProfile.company.companyRole}
      initialCompany={loadedProfile.company}
      initialSeller={loadedProfile.seller}
      initialBuyer={loadedProfile.buyer}
    />
  );
}

function CompanyProfileForm({
  role,
  initialCompany,
  initialSeller,
  initialBuyer,
}: {
  role: "seller" | "buyer";
  initialCompany: CompanyProfile;
  initialSeller: SellerCompanyProfile;
  initialBuyer: BuyerCompanyProfile;
}) {
  const { locale, t } = useI18n();
  const [company, setCompany] = useState(initialCompany);
  const [seller, setSeller] = useState(initialSeller);
  const [buyer, setBuyer] = useState(initialBuyer);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveQueuedAfterUpload, setSaveQueuedAfterUpload] = useState(false);
  const [clearCompanyLogo, setClearCompanyLogo] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CompanyFormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const saveQueuedAfterUploadRef = useRef(false);
  const leaveMessage = t("settings.unsavedChangesWarning");
  useUnsavedChangesWarning(dirty && !isSaving && !isUploading, leaveMessage);
  const { draft, clearDraft, discardDraft } = useDraftBackup<CompanyDraft>(
    `bridgemarket:company-draft:${initialCompany.ownerClerkUserId}:${role}`,
    { company, seller, buyer },
    dirty && !isSaving && !isUploading,
  );

  function markDirty() {
    setDirty(true);
    setSaved(false);
    setError("");
  }

  function updateCompany<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) {
    setCompany((current) => ({ ...current, [key]: value }));
    if (
      key === "legalName" ||
      key === "country" ||
      key === "city" ||
      key === "stateOrProvince" ||
      key === "businessAddress" ||
      key === "website"
    ) {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
    markDirty();
  }

  function validate() {
    const nextErrors: CompanyFormErrors = {};
    if (!company.legalName.trim()) {
      nextErrors.legalName = t("settings.requiredField");
    }
    const expectedCountry = role === "seller" ? SOUTH_KOREA : UNITED_STATES;
    if (!expectedCountry) {
      nextErrors.country = t("settings.requiredField");
    }
    if (!company.city.trim()) {
      nextErrors.city = t("settings.requiredField");
    }
    if (role === "buyer" && !company.stateOrProvince.trim()) {
      nextErrors.stateOrProvince = t("settings.requiredField");
    }
    if (!company.businessAddress.trim()) {
      nextErrors.businessAddress = t("settings.requiredField");
    }
    if (company.website.trim()) {
      try {
        new URL(company.website);
      } catch {
        nextErrors.website = t("settings.invalidUrl");
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function restoreDraft() {
    if (!draft) return;
    setCompany(draft.company);
    setSeller(draft.seller);
    setBuyer(draft.buyer);
    setDirty(true);
    setSaved(false);
    setError("");
    setFieldErrors({});
    discardDraft();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (isUploading) {
      saveQueuedAfterUploadRef.current = true;
      setSaveQueuedAfterUpload(true);
      setSaved(false);
      setError("");
      return;
    }
    if (!validate()) return;

    setIsSaving(true);
    setSaved(false);
    setError("");

    try {
      const companyForSave = {
        ...company,
        country: role === "seller" ? SOUTH_KOREA : UNITED_STATES,
        stateOrProvince: role === "buyer" ? company.stateOrProvince : "",
      };
      debugCompanyLogo("submitting company profile", {
        companyId: companyForSave.id,
        role,
        logoOriginalUrl: companyForSave.logoOriginalUrl,
        logoThumbnailUrl: companyForSave.logoThumbnailUrl,
        logoUrl: companyForSave.logoUrl,
        useDefaultLogo: companyForSave.useDefaultLogo,
      });
      const response = await fetch("/api/account/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...companyForSave,
          clearCompanyLogo,
          sellerProfile:
            role === "seller"
              ? {
                  koreanBusinessRegistrationNumber:
                    seller.businessRegistrationNumber,
                  representativeName: seller.representativeName,
                  exportExperience: seller.exportExperience,
                  exportCountries: seller.exportCountries,
                  productCategories: seller.productCategories,
                  minimumOrderQuantity: seller.minimumOrderQuantity,
                  leadTime: seller.leadTime,
                  certifications: seller.certifications,
                  shippingTerms: seller.shippingTerms,
                  paymentTerms: seller.paymentTerms,
                  factoryOrDistributorStatus: seller.supplierType,
                }
              : undefined,
          buyerProfile: role === "buyer" ? buyer : undefined,
        }),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.companySaveError")));
        return;
      }

      const savedRecord = (await response.json()) as CompanyRecord;
      debugCompanyLogo("company save response", {
        companyId: savedRecord.id ?? null,
        role: savedRecord.companyRole ?? null,
        logoOriginalUrl: savedRecord.logoOriginalUrl ?? null,
        logoThumbnailUrl: savedRecord.logoThumbnailUrl ?? null,
        logoUrl: savedRecord.logoUrl ?? null,
        useDefaultLogo: savedRecord.useDefaultLogo ?? null,
      });
      rememberAccountCompany(initialCompany.ownerClerkUserId, savedRecord);
      setSaveQueuedAfterUpload(false);
      setClearCompanyLogo(false);
      const savedProfile = buildCompanyProfile(
        savedRecord,
        role,
        initialCompany.ownerClerkUserId,
      );
      setCompany(savedProfile.company);
      setSeller(savedProfile.seller);
      setBuyer(savedProfile.buyer);
      setDirty(false);
      setSaved(true);
      clearDraft();
    } catch {
      setError(t("settings.companySaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  function updateLogo(image: UploadedListingImage) {
    debugCompanyLogo("company logo selected", {
      storagePath: image.storagePath,
      originalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl: image.mainUrl,
    });
    setCompany((current) => ({
      ...current,
      logoOriginalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl: image.mainUrl,
      useDefaultLogo: false,
    }));
    setClearCompanyLogo(false);
    markDirty();
  }

  function handleUploadingChange(uploading: boolean) {
    setIsUploading(uploading);
    if (uploading || !saveQueuedAfterUploadRef.current) return;
    saveQueuedAfterUploadRef.current = false;
    setSaveQueuedAfterUpload(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  const companyLogoPreviewUrl =
    company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl;

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-6" autoComplete="off">
      {draft ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{t("settings.draftAvailable")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-md bg-amber-900 px-3 py-2 font-medium text-white"
            >
              {t("settings.restoreDraft")}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 font-medium text-amber-900"
            >
              {t("settings.discardDraft")}
            </button>
          </div>
        </div>
      ) : null}
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <SingleImageUploader
          kind="company_logo"
          imageUrl={companyLogoPreviewUrl}
          imageUrls={[
            company.logoThumbnailUrl ?? "",
            company.logoUrl ?? "",
            company.logoOriginalUrl ?? "",
          ]}
          label={t("settings.companyLogoUpload")}
          companyId={company.id.startsWith("new-") ? undefined : company.id}
          onUploaded={updateLogo}
          onUploadError={(message) => {
            saveQueuedAfterUploadRef.current = false;
            setSaveQueuedAfterUpload(false);
            setError(message);
          }}
          onUploadingChange={handleUploadingChange}
        />
        {companyLogoPreviewUrl && !company.useDefaultLogo ? (
          <button
            type="button"
            onClick={() => {
              setCompany((current) => ({
                ...current,
                logoOriginalUrl: "",
                logoThumbnailUrl: "",
                logoUrl: "",
                useDefaultLogo: true,
              }));
              setClearCompanyLogo(true);
              markDirty();
            }}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
          >
            {t("settings.removeCompanyLogo")}
          </button>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <Field label={t("settings.legalName")} value={company.legalName} onChange={(value) => updateCompany("legalName", value)} error={fieldErrors.legalName} required />
        <Field label={t("settings.tradeName")} value={company.tradeName ?? ""} onChange={(value) => updateCompany("tradeName", value)} />
        <Field label={t("settings.website")} type="url" value={company.website} onChange={(value) => updateCompany("website", value)} error={fieldErrors.website} />
        <SelectField
          label={t("settings.country")}
          value={role === "seller" ? SOUTH_KOREA : UNITED_STATES}
          onChange={(value) => updateCompany("country", value)}
          options={[{ value: role === "seller" ? SOUTH_KOREA : UNITED_STATES, label: role === "seller" ? SOUTH_KOREA : UNITED_STATES }]}
          error={fieldErrors.country}
          required
          disabled
        />
        {role === "buyer" ? (
          <>
            <Field label={t("settings.city")} value={company.city} onChange={(value) => updateCompany("city", value)} error={fieldErrors.city} required />
            <SelectField
              label={t("settings.state")}
              value={company.stateOrProvince}
              onChange={(value) => updateCompany("stateOrProvince", value)}
              options={getUsStateOptions(locale)}
              placeholder={t("settings.selectState")}
              error={fieldErrors.stateOrProvince}
              required
            />
          </>
        ) : (
          <SelectField
            label={t("settings.cityRegion")}
            value={company.city}
            onChange={(value) => updateCompany("city", value)}
            options={getKoreanRegionOptions(locale)}
            placeholder={t("settings.selectCityRegion")}
            error={fieldErrors.city}
            required
          />
        )}
        <Field label={t("settings.businessAddress")} value={company.businessAddress} onChange={(value) => updateCompany("businessAddress", value)} error={fieldErrors.businessAddress} className="sm:col-span-2" required />
        {role === "seller" ? (
          <CheckboxGroup
            label={t("settings.categories")}
            values={company.categories}
            onChange={(values) => updateCompany("categories", values)}
            options={getSellerProductCategoryOptions(locale)}
            className="sm:col-span-2"
          />
        ) : null}
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">
            {role === "buyer" ? t("settings.marketStrategy") : t("settings.companyDescription")}
          </span>
          <textarea value={company.description} onChange={(event) => updateCompany("description", event.target.value)} rows={4} className="rounded-md border border-zinc-200 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={company.useDefaultLogo} onChange={(event) => updateCompany("useDefaultLogo", event.target.checked)} />
          {t("settings.useDefaultLogo")}
        </label>
      </section>

      {role === "seller" ? (
        <SellerFields seller={seller} setSeller={setSeller} onDirty={markDirty} />
      ) : (
        <BuyerFields buyer={buyer} setBuyer={setBuyer} onDirty={markDirty} />
      )}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSaving} className="rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {isSaving
            ? t("settings.saving")
            : isUploading
              ? t("settings.saveAfterUpload")
              : t("settings.saveCompany")}
        </button>
        {saved ? <span className="text-sm text-emerald-700">{t("settings.saved")}</span> : null}
      </div>
      {isUploading ? (
        <p className="text-sm text-amber-700" aria-live="polite">
          {saveQueuedAfterUpload
            ? t("settings.logoUploadSaveQueued")
            : t("settings.logoUploadInProgress")}
        </p>
      ) : null}
    </form>
  );
}

function SellerFields({
  seller,
  setSeller,
  onDirty,
}: {
  seller: SellerCompanyProfile;
  setSeller: React.Dispatch<React.SetStateAction<SellerCompanyProfile>>;
  onDirty: () => void;
}) {
  const { locale, t } = useI18n();
  const update = <K extends keyof SellerCompanyProfile>(key: K, value: SellerCompanyProfile[K]) => {
    setSeller((current) => ({ ...current, [key]: value }));
    onDirty();
  };

  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="text-base font-semibold text-zinc-950">{t("settings.sellerProfileSection")}</h3>
      </div>
      <Field label={t("settings.registrationNumber")} value={seller.businessRegistrationNumber} onChange={(value) => update("businessRegistrationNumber", value)} />
      <Field label={t("settings.representativeName")} value={seller.representativeName} onChange={(value) => update("representativeName", value)} />
      <Field label={t("settings.exportExperience")} value={seller.exportExperience} onChange={(value) => update("exportExperience", value)} className="sm:col-span-2" />
      <Field label={t("settings.exportCountries")} value={joined(seller.exportCountries)} onChange={(value) => update("exportCountries", list(value))} />
      <CheckboxGroup
        label={t("settings.productCategories")}
        values={seller.productCategories}
        onChange={(values) => update("productCategories", values)}
        options={getSellerProductCategoryOptions(locale)}
      />
      <MoqField
        label={t("settings.minimumOrderQuantity")}
        value={seller.minimumOrderQuantity}
        onChange={(value) => update("minimumOrderQuantity", value)}
      />
      <SelectField
        label={t("settings.leadTime")}
        value={seller.leadTime}
        onChange={(value) => update("leadTime", value)}
        options={getLeadTimeOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <Field label={t("settings.certifications")} value={joined(seller.certifications)} onChange={(value) => update("certifications", list(value))} />
      <Field label={t("settings.shippingTerms")} value={joined(seller.shippingTerms)} onChange={(value) => update("shippingTerms", list(value))} />
      <Field label={t("settings.paymentTerms")} value={joined(seller.paymentTerms)} onChange={(value) => update("paymentTerms", list(value))} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-zinc-700">{t("settings.supplierType")}</span>
        <select value={seller.supplierType} onChange={(event) => update("supplierType", event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3">
          {getSellerSupplierTypeOptions(locale).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function BuyerFields({
  buyer,
  setBuyer,
  onDirty,
}: {
  buyer: BuyerCompanyProfile;
  setBuyer: React.Dispatch<React.SetStateAction<BuyerCompanyProfile>>;
  onDirty: () => void;
}) {
  const { locale, t } = useI18n();
  const update = <K extends keyof BuyerCompanyProfile>(key: K, value: BuyerCompanyProfile[K]) => {
    setBuyer((current) => ({ ...current, [key]: value }));
    onDirty();
  };

  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="text-base font-semibold text-zinc-950">{t("settings.buyerRequirementsSection")}</h3>
      </div>
      <SelectField
        label={t("settings.buyerType")}
        value={buyer.buyerType}
        onChange={(value) => update("buyerType", value as BuyerCompanyProfile["buyerType"])}
        options={getBuyerTypeOptions(locale)}
      />
      <CheckboxGroup
        label={t("settings.purchasingCategories")}
        values={buyer.purchasingCategories}
        onChange={(values) => update("purchasingCategories", values)}
        options={getBuyerCategoryOptions(locale)}
        className="sm:col-span-2"
      />
      <SelectField
        label={t("onboarding.preferredSupplierType")}
        value={buyer.preferredSupplierType}
        onChange={(value) => update("preferredSupplierType", value)}
        options={getSupplierTypeOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <SelectField
        label={t("settings.targetOrderSize")}
        value={buyer.targetOrderSize}
        onChange={(value) => update("targetOrderSize", value)}
        options={getOrderSizeOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <SelectField
        label={t("settings.monthlyImportVolume")}
        value={buyer.monthlyImportVolume}
        onChange={(value) => update("monthlyImportVolume", value)}
        options={getImportVolumeOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <SelectField
        label={t("settings.importExperience")}
        value={buyer.importExperience}
        onChange={(value) => update("importExperience", value)}
        options={getImportExperienceOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <SelectField
        label={t("settings.purchaseTimeline")}
        value={buyer.purchaseTimeline}
        onChange={(value) => update("purchaseTimeline", value)}
        options={getSourcingTimelineOptions(locale)}
        placeholder={t("onboarding.select")}
      />
      <CheckboxGroup
        label={t("settings.salesChannels")}
        values={buyer.salesChannels}
        onChange={(values) => update("salesChannels", values)}
        options={getSalesChannelOptions(locale)}
        className="sm:col-span-2"
      />
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 sm:col-span-2">
        <p className="font-medium text-zinc-800">{t("settings.contactPersonSection")}</p>
        <p className="mt-1 leading-6">{t("settings.contactPersonManaged")}</p>
      </div>
    </section>
  );
}

function MoqField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { locale, t } = useI18n();
  const parsed = parseMoqValue(value);

  return (
    <fieldset className="grid gap-1 text-sm">
      <legend className="font-medium text-zinc-700">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-[1fr_132px]">
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={parsed.quantity}
          aria-label={t("settings.moqQuantity")}
          onChange={(event) =>
            onChange(formatMoqValue(event.target.value, parsed.unit))
          }
          className="h-10 rounded-md border border-zinc-200 px-3"
        />
        <select
          value={parsed.unit}
          aria-label={t("settings.moqUnit")}
          onChange={(event) =>
            onChange(formatMoqValue(parsed.quantity, event.target.value))
          }
          className="h-10 rounded-md border border-zinc-200 bg-white px-3"
        >
          {getMoqUnitOptions(locale).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
  error,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <select
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 aria-invalid:border-red-300 disabled:bg-zinc-50 disabled:text-zinc-500"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function CheckboxGroup({
  label,
  values,
  onChange,
  options,
  className,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  className?: string;
}) {
  function toggle(value: string) {
    const next = new Set(values);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(Array.from(next));
  }

  return (
    <fieldset className={`grid gap-2 text-sm ${className ?? ""}`}>
      <legend className="font-medium text-zinc-700">{label}</legend>
      <div className="grid gap-2 rounded-md border border-zinc-200 bg-white p-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-zinc-700">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="size-4 rounded border-zinc-300"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
  fieldName,
  preventAutofill = false,
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
  className?: string;
  fieldName?: string;
  preventAutofill?: boolean;
  error?: string;
  required?: boolean;
}) {
  const inputName =
    fieldName ?? label.trim().toLowerCase().replace(/\s+/g, "-");

  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type={type}
        name={inputName}
        placeholder={label}
        required={required}
        autoComplete={preventAutofill ? "new-password" : "off"}
        data-1p-ignore={preventAutofill ? "true" : undefined}
        data-lpignore={preventAutofill ? "true" : undefined}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 px-3 aria-invalid:border-red-300"
      />
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
