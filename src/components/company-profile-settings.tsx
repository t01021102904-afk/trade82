"use client";

import { useUser } from "@clerk/nextjs";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { SingleImageUploader } from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import type { UploadedListingImage } from "@/lib/marketplace";
import type {
  BuyerCompanyProfile,
  CompanyProfile,
  SellerCompanyProfile,
} from "@/lib/types";

function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joined(value: string[]) {
  return value.join(", ");
}

export function CompanyProfileSettings() {
  const { isLoaded, user } = useUser();
  const { locale, t } = useI18n();
  const [loadedProfile, setLoadedProfile] = useState<{
    company: CompanyProfile;
    seller: SellerCompanyProfile;
    buyer: BuyerCompanyProfile;
  } | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const metadataRole = user.publicMetadata.role;
    if (
      metadataRole !== "seller" &&
      metadataRole !== "buyer" &&
      metadataRole !== "both"
    ) {
      return;
    }
    const role = metadataRole === "buyer" ? "buyer" : "seller";
    const now = new Date().toISOString();

    void fetch("/api/account/company")
      .then((response) => (response.ok ? response.json() : []))
      .then((companies: Array<Record<string, unknown>>) => {
        const stored = companies.find((item) => item.companyRole === role);
        const companyId = String(stored?.id ?? `new-${role}`);
        const sellerProfile = (stored?.sellerProfile ?? {}) as Record<string, unknown>;
        const buyerProfile = (stored?.buyerProfile ?? {}) as Record<string, unknown>;
        setLoadedProfile({
          company: {
            id: companyId,
            ownerClerkUserId: user.id,
            companyRole: role,
            legalName: String(stored?.legalName ?? ""),
            tradeName: String(stored?.tradeName ?? ""),
            logoOriginalUrl: String(stored?.logoOriginalUrl ?? ""),
            logoThumbnailUrl: String(stored?.logoThumbnailUrl ?? ""),
            logoUrl: String(stored?.logoUrl ?? ""),
            useDefaultLogo: stored?.useDefaultLogo !== false,
            website: String(stored?.website ?? ""),
            country: String(
              stored?.country ??
                (role === "seller" ? "South Korea" : "United States"),
            ),
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
            productCategories:
              (sellerProfile.productCategories as string[]) ?? [],
            minimumOrderQuantity: String(
              sellerProfile.minimumOrderQuantity ?? "",
            ),
            leadTime: String(sellerProfile.leadTime ?? ""),
            certifications: (sellerProfile.certifications as string[]) ?? [],
            shippingTerms: (sellerProfile.shippingTerms as string[]) ?? [],
            paymentTerms: (sellerProfile.paymentTerms as string[]) ?? [],
            supplierType:
              (sellerProfile.factoryOrDistributorStatus as SellerCompanyProfile["supplierType"]) ??
              "factory",
          },
          buyer: {
            companyId,
            buyerType:
              (buyerProfile.buyerType as BuyerCompanyProfile["buyerType"]) ??
              "importer",
            purchasingCategories:
              (buyerProfile.purchasingCategories as string[]) ?? [],
            targetOrderSize: String(buyerProfile.targetOrderSize ?? ""),
            monthlyImportVolume: String(buyerProfile.monthlyImportVolume ?? ""),
            importExperience: String(buyerProfile.importExperience ?? ""),
            salesChannels: (buyerProfile.salesChannels as string[]) ?? [],
            purchaseTimeline: String(buyerProfile.purchaseTimeline ?? ""),
            buyerRequirements: "",
          },
        });
      });
  }, [isLoaded, user]);

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

  if (!isLoaded || !user || !loadedProfile) {
    return <div className="text-sm text-zinc-600">{t("common.loading")}</div>;
  }

  return (
    <CompanyProfileForm
      key={`${loadedProfile.company.id}-${loadedProfile.company.updatedAt}`}
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
  const { t } = useI18n();
  const [company, setCompany] = useState(initialCompany);
  const [seller, setSeller] = useState(initialSeller);
  const [buyer, setBuyer] = useState(initialBuyer);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function updateCompany<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) {
    setCompany((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const response = await fetch("/api/account/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...company,
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
    if (response.ok) {
      const savedCompany = (await response.json()) as {
        id: string;
        verificationStatus: CompanyProfile["verificationStatus"];
        updatedAt: string;
      };
      setCompany((current) => ({
        ...current,
        id: savedCompany.id,
        verificationStatus: savedCompany.verificationStatus,
        updatedAt: savedCompany.updatedAt,
      }));
      setSaved(true);
    }
    setIsSaving(false);
  }

  function updateLogo(image: UploadedListingImage) {
    setCompany((current) => ({
      ...current,
      logoOriginalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl: image.mainUrl,
      useDefaultLogo: false,
    }));
    setSaved(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-6" autoComplete="off">
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <SingleImageUploader
          kind="company_logo"
          imageUrl={company.logoUrl}
          label={t("settings.companyLogoUpload")}
          companyId={company.id.startsWith("new-") ? undefined : company.id}
          onUploaded={updateLogo}
          onUploadingChange={setIsUploading}
        />
        {company.logoUrl && !company.useDefaultLogo ? (
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
              setSaved(false);
            }}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
          >
            {t("settings.removeCompanyLogo")}
          </button>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <Field label={t("settings.legalName")} value={company.legalName} onChange={(value) => updateCompany("legalName", value)} />
        <Field label={t("settings.tradeName")} value={company.tradeName ?? ""} onChange={(value) => updateCompany("tradeName", value)} />
        <Field label={t("settings.website")} type="url" value={company.website} onChange={(value) => updateCompany("website", value)} />
        <Field label={t("settings.country")} value={company.country} onChange={(value) => updateCompany("country", value)} />
        <Field label={t("settings.city")} value={company.city} onChange={(value) => updateCompany("city", value)} />
        <Field label={t("settings.stateProvince")} value={company.stateOrProvince} onChange={(value) => updateCompany("stateOrProvince", value)} />
        <Field label={t("settings.businessAddress")} value={company.businessAddress} onChange={(value) => updateCompany("businessAddress", value)} className="sm:col-span-2" />
        <Field fieldName="companyCategories" label={t("settings.categories")} value={joined(company.categories)} onChange={(value) => updateCompany("categories", list(value))} className="sm:col-span-2" preventAutofill />
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">{t("settings.companyDescription")}</span>
          <textarea value={company.description} onChange={(event) => updateCompany("description", event.target.value)} rows={4} className="rounded-md border border-zinc-200 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={company.useDefaultLogo} onChange={(event) => updateCompany("useDefaultLogo", event.target.checked)} />
          {t("settings.useDefaultLogo")}
        </label>
      </section>

      {role === "seller" ? (
        <SellerFields seller={seller} setSeller={setSeller} />
      ) : (
        <BuyerFields buyer={buyer} setBuyer={setBuyer} />
      )}

      <div className="flex items-center gap-3">
        <button disabled={isSaving || isUploading} className="rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {isSaving ? t("settings.saving") : t("settings.saveCompany")}
        </button>
        {saved ? <span className="text-sm text-emerald-700">{t("settings.saved")}</span> : null}
      </div>
    </form>
  );
}

function SellerFields({
  seller,
  setSeller,
}: {
  seller: SellerCompanyProfile;
  setSeller: React.Dispatch<React.SetStateAction<SellerCompanyProfile>>;
}) {
  const { t } = useI18n();
  const update = <K extends keyof SellerCompanyProfile>(key: K, value: SellerCompanyProfile[K]) =>
    setSeller((current) => ({ ...current, [key]: value }));

  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
      <Field label={t("settings.registrationNumber")} value={seller.businessRegistrationNumber} onChange={(value) => update("businessRegistrationNumber", value)} />
      <Field label={t("settings.representativeName")} value={seller.representativeName} onChange={(value) => update("representativeName", value)} />
      <Field label={t("settings.exportExperience")} value={seller.exportExperience} onChange={(value) => update("exportExperience", value)} className="sm:col-span-2" />
      <Field label={t("settings.exportCountries")} value={joined(seller.exportCountries)} onChange={(value) => update("exportCountries", list(value))} />
      <Field fieldName="sellerProductCategories" label={t("settings.productCategories")} value={joined(seller.productCategories)} onChange={(value) => update("productCategories", list(value))} preventAutofill />
      <Field label={t("settings.minimumOrderQuantity")} value={seller.minimumOrderQuantity} onChange={(value) => update("minimumOrderQuantity", value)} />
      <Field label={t("settings.leadTime")} value={seller.leadTime} onChange={(value) => update("leadTime", value)} />
      <Field label={t("settings.certifications")} value={joined(seller.certifications)} onChange={(value) => update("certifications", list(value))} />
      <Field label={t("settings.shippingTerms")} value={joined(seller.shippingTerms)} onChange={(value) => update("shippingTerms", list(value))} />
      <Field label={t("settings.paymentTerms")} value={joined(seller.paymentTerms)} onChange={(value) => update("paymentTerms", list(value))} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-zinc-700">{t("settings.supplierType")}</span>
        <select value={seller.supplierType} onChange={(event) => update("supplierType", event.target.value as SellerCompanyProfile["supplierType"])} className="h-10 rounded-md border border-zinc-200 bg-white px-3">
          <option value="factory">Factory</option>
          <option value="distributor">Distributor</option>
          <option value="brand_owner">Brand owner</option>
          <option value="wholesaler">Wholesaler</option>
        </select>
      </label>
    </section>
  );
}

function BuyerFields({
  buyer,
  setBuyer,
}: {
  buyer: BuyerCompanyProfile;
  setBuyer: React.Dispatch<React.SetStateAction<BuyerCompanyProfile>>;
}) {
  const { t } = useI18n();
  const update = <K extends keyof BuyerCompanyProfile>(key: K, value: BuyerCompanyProfile[K]) =>
    setBuyer((current) => ({ ...current, [key]: value }));

  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-zinc-700">{t("settings.buyerType")}</span>
        <select value={buyer.buyerType} onChange={(event) => update("buyerType", event.target.value as BuyerCompanyProfile["buyerType"])} className="h-10 rounded-md border border-zinc-200 bg-white px-3">
          <option value="importer">Importer</option>
          <option value="distributor">Distributor</option>
          <option value="retailer">Retailer</option>
          <option value="online_seller">Online seller</option>
          <option value="wholesaler">Wholesaler</option>
        </select>
      </label>
      <Field fieldName="buyerPurchasingCategories" label={t("settings.purchasingCategories")} value={joined(buyer.purchasingCategories)} onChange={(value) => update("purchasingCategories", list(value))} preventAutofill />
      <Field label={t("settings.targetOrderSize")} value={buyer.targetOrderSize} onChange={(value) => update("targetOrderSize", value)} />
      <Field label={t("settings.monthlyImportVolume")} value={buyer.monthlyImportVolume} onChange={(value) => update("monthlyImportVolume", value)} />
      <Field label={t("settings.importExperience")} value={buyer.importExperience} onChange={(value) => update("importExperience", value)} />
      <Field label={t("settings.purchaseTimeline")} value={buyer.purchaseTimeline} onChange={(value) => update("purchaseTimeline", value)} />
      <Field label={t("settings.salesChannels")} value={joined(buyer.salesChannels)} onChange={(value) => update("salesChannels", list(value))} />
      <Field label={t("settings.buyerRequirements")} value={buyer.buyerRequirements} onChange={(value) => update("buyerRequirements", value)} className="sm:col-span-2" />
    </section>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
  className?: string;
  fieldName?: string;
  preventAutofill?: boolean;
}) {
  const inputName =
    fieldName ?? label.trim().toLowerCase().replace(/\s+/g, "-");

  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        name={inputName}
        placeholder={label}
        autoComplete={preventAutofill ? "new-password" : "off"}
        data-1p-ignore={preventAutofill ? "true" : undefined}
        data-lpignore={preventAutofill ? "true" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 px-3"
      />
    </label>
  );
}
