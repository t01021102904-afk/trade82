"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import {
  SingleImageUploader,
} from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import {
  OnboardingStepper,
  type OnboardingStepId,
} from "@/components/onboarding-stepper";
import { ProfilePreviewPanel } from "@/components/premium-motion";
import {
  emptyRichProductForm,
  productPayloadFromForm,
  RichProductFormFields,
  type RichProductFormErrors,
  type RichProductFormValue,
} from "@/components/rich-product-form-fields";
import {
  useDraftBackup,
  useUnsavedChangesWarning,
} from "@/hooks/use-form-reliability";
import {
  getBuyerCategoryOptions,
  getBuyerTypeOptions,
  getImportExperienceOptions,
  getImportVolumeOptions,
  getKoreanRegionOptions,
  getOrderSizeOptions,
  getSalesChannelOptions,
  getSellerCompanyTypeOptions,
  getSellerProductCategoryOptions,
  getSourcingTimelineOptions,
  getSupplierTypeOptions,
  getUsStateOptions,
  SOUTH_KOREA,
  UNITED_STATES,
  type SelectOption,
} from "@/lib/company-select-options";
import { withLocale } from "@/lib/i18n";
import type { UploadedListingImage } from "@/lib/marketplace";

type FlowStep = "company" | "personal" | "product" | "sourcing";

type CompanyStep = {
  companyName: string;
  website: string;
  country: string;
  city: string;
  stateOrProvince: string;
  companyType: string;
  categories: string;
  description: string;
  logoOriginalUrl: string;
  logoThumbnailUrl: string;
  logoUrl: string;
  certificateFileName: string;
};

type PersonalStep = {
  displayName: string;
  email: string;
  avatarOriginalUrl: string;
  avatarUrl: string;
  jobTitle: string;
  department: string;
  phoneNumber: string;
  linkedinUrl: string;
};

type SellerProductStep = RichProductFormValue;

type BuyerSourcingStep = {
  interestedCategories: string;
  preferredSupplierType: string;
  expectedOrderRange: string;
  importVolume: string;
  importExperience: string;
  purchaseTimeline: string;
  salesChannels: string;
  messagePreference: string;
};

type DraftState = {
  step: FlowStep;
  company: CompanyStep;
  personal: PersonalStep;
  product: SellerProductStep;
  sourcing: BuyerSourcingStep;
  companyId: string;
};

function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joined(values: string[]) {
  return values.join(", ");
}

function initialCompany(kind: "buyer" | "seller"): CompanyStep {
  return {
    companyName: "",
    website: "",
    country: kind === "seller" ? SOUTH_KOREA : UNITED_STATES,
    city: "",
    stateOrProvince: "",
    companyType: kind === "seller" ? "manufacturer" : "importer",
    categories: "",
    description: "",
    logoOriginalUrl: "",
    logoThumbnailUrl: "",
    logoUrl: "",
    certificateFileName: "",
  };
}

const emptyPersonal: PersonalStep = {
  displayName: "",
  email: "",
  avatarOriginalUrl: "",
  avatarUrl: "",
  jobTitle: "",
  department: "",
  phoneNumber: "",
  linkedinUrl: "",
};

const emptyProduct: SellerProductStep = emptyRichProductForm;

const emptySourcing: BuyerSourcingStep = {
  interestedCategories: "",
  preferredSupplierType: "",
  expectedOrderRange: "",
  importVolume: "",
  importExperience: "",
  purchaseTimeline: "",
  salesChannels: "",
  messagePreference: "",
};

async function readJsonError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return result?.error ?? fallback;
}

function isValidLinkedInUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function stepToId(step: FlowStep): OnboardingStepId {
  return step === "sourcing" ? "sourcing" : step;
}

function debugOnboardingLogo(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[onboarding-logo] ${message}`, details);
  }
}

export function OnboardingForm({ kind }: { kind: "buyer" | "seller" }) {
  const { user } = useUser();
  const { locale, t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("company");
  const [company, setCompany] = useState<CompanyStep>(() => initialCompany(kind));
  const [personal, setPersonal] = useState<PersonalStep>(() => ({
    ...emptyPersonal,
    displayName: user?.fullName ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
  }));
  const [product, setProduct] = useState<SellerProductStep>(emptyProduct);
  const [sourcing, setSourcing] = useState<BuyerSourcingStep>(emptySourcing);
  const [companyId, setCompanyId] = useState("");
  const [privateDocument, setPrivateDocument] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lastValidCompanyLogo = useRef({
    logoOriginalUrl: "",
    logoThumbnailUrl: "",
    logoUrl: "",
  });
  const leaveMessage = t("settings.unsavedChangesWarning");
  const confirmLeave = useUnsavedChangesWarning(
    dirty && !saving && !uploading,
    leaveMessage,
  );
  const { draft, clearDraft, discardDraft } = useDraftBackup<DraftState>(
    `bridgemarket:onboarding-flow:${kind}:${locale}`,
    { step, company, personal, product, sourcing, companyId },
    dirty && !saving && !uploading,
  );

  function markDirty() {
    setDirty(true);
    setSuccess("");
    setError("");
  }

  function updateCompany<K extends keyof CompanyStep>(
    key: K,
    value: CompanyStep[K],
  ) {
    setCompany((current) => {
      const isLogoKey =
        key === "logoOriginalUrl" ||
        key === "logoThumbnailUrl" ||
        key === "logoUrl";
      const isEmptyLogoValue = isLogoKey && typeof value === "string" && !value.trim();
      const hasCurrentLogo = Boolean(
        current.logoOriginalUrl || current.logoThumbnailUrl || current.logoUrl,
      );
      if (isEmptyLogoValue && hasCurrentLogo) {
        debugOnboardingLogo("ignored empty company logo update", {
          kind,
          key,
          currentLogoOriginalUrl: current.logoOriginalUrl,
          currentLogoThumbnailUrl: current.logoThumbnailUrl,
          currentLogoUrl: current.logoUrl,
        });
        return current;
      }
      if (isLogoKey) {
        debugOnboardingLogo("company logo field update", {
          kind,
          key,
          value,
        });
      }
      return { ...current, [key]: value };
    });
    markDirty();
  }

  function updateCompanyLogo(image: UploadedListingImage) {
    const logoUrl = image.mainUrl || image.cardUrl || image.originalUrl;
    const nextLogo = {
      logoOriginalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl,
    };
    lastValidCompanyLogo.current = nextLogo;
    debugOnboardingLogo("stored uploaded company logo in form state", {
      kind,
      storagePath: image.storagePath,
      ...nextLogo,
    });
    setCompany((current) => ({
      ...current,
      ...nextLogo,
    }));
    markDirty();
  }

  function updatePersonal<K extends keyof PersonalStep>(
    key: K,
    value: PersonalStep[K],
  ) {
    setPersonal((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  function updateProduct<K extends keyof SellerProductStep>(
    key: K,
    value: SellerProductStep[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  function updateSourcing<K extends keyof BuyerSourcingStep>(
    key: K,
    value: BuyerSourcingStep[K],
  ) {
    setSourcing((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  function restoreDraft() {
    if (!draft) return;
    debugOnboardingLogo("restoring onboarding draft", {
      kind,
      draftLogoOriginalUrl: draft.company.logoOriginalUrl,
      draftLogoThumbnailUrl: draft.company.logoThumbnailUrl,
      draftLogoUrl: draft.company.logoUrl,
      lastValidLogoUrl: lastValidCompanyLogo.current.logoUrl,
    });
    setStep(draft.step);
    setCompany(draft.company);
    setPersonal(draft.personal);
    setProduct(draft.product);
    setSourcing(draft.sourcing);
    setCompanyId(draft.companyId);
    setPrivateDocument(null);
    setDirty(true);
    setError("");
    setSuccess("");
    discardDraft();
  }

  useEffect(() => {
    debugOnboardingLogo("component mounted", { kind });
    return () => {
      debugOnboardingLogo("component unmounted", { kind });
    };
  }, [kind]);

  useEffect(() => {
    debugOnboardingLogo("company logo state", {
      kind,
      logoOriginalUrl: company.logoOriginalUrl,
      logoThumbnailUrl: company.logoThumbnailUrl,
      logoUrl: company.logoUrl,
      lastValidLogoUrl: lastValidCompanyLogo.current.logoUrl,
    });
  }, [company.logoOriginalUrl, company.logoThumbnailUrl, company.logoUrl, kind]);

  function selectStep(selected: OnboardingStepId) {
    if (!confirmLeave()) return;
    if (selected === "role") {
      router.push(withLocale("/onboarding/role", locale));
      return;
    }
    if (selected === "company") setStep("company");
    if (selected === "personal" && companyId) setStep("personal");
    if (selected === "product" && companyId) setStep("product");
    if (selected === "sourcing" && companyId) setStep("sourcing");
  }

  async function saveCompanyStep(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (saving || uploading) return;
    if (!company.companyName.trim()) {
      setError(t("onboarding.companyNameRequired"));
      return;
    }
    const expectedCountry = kind === "seller" ? SOUTH_KOREA : UNITED_STATES;
    if (!expectedCountry || !company.city.trim()) {
      setError(t("onboarding.locationRequired"));
      return;
    }
    if (kind === "buyer" && !company.stateOrProvince.trim()) {
      setError(t("onboarding.locationRequired"));
      return;
    }
    if (!company.companyType.trim()) {
      setError(t("onboarding.companyTypeRequired"));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyPayload()),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.companySaveError")));
        return;
      }

      const savedCompany = (await response.json()) as { id: string };
      setCompanyId(savedCompany.id);

      if (privateDocument) {
        const documentForm = new FormData();
        documentForm.set("uploadType", "verification_document");
        documentForm.set("companyId", savedCompany.id);
        documentForm.set("file", privateDocument);
        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: documentForm,
        });
        if (!uploadResponse.ok) {
          setError(
            await readJsonError(uploadResponse, t("onboarding.privateDocumentUploadError")),
          );
          return;
        }
      }

      clearDraft();
      setDirty(false);
      setSuccess(t("onboarding.companyStepSaved"));
      setStep("personal");
    } catch {
      setError(t("settings.companySaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function savePersonalStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (!personal.displayName.trim()) {
      setError(t("onboarding.personalNameRequired"));
      return;
    }
    if (!isValidLinkedInUrl(personal.linkedinUrl)) {
      setError(t("settings.invalidLinkedInUrl"));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: personal.displayName,
          email: personal.email,
          avatarOriginalUrl: personal.avatarOriginalUrl,
          avatarUrl: personal.avatarUrl,
          companyAffiliation: company.companyName,
          jobTitle: personal.jobTitle,
          department: personal.department,
          phoneNumber: personal.phoneNumber,
          linkedinUrl: personal.linkedinUrl,
          country: kind === "seller" ? SOUTH_KOREA : UNITED_STATES,
      city: company.city,
      stateOrProvince: company.stateOrProvince,
      preferredLanguage: locale,
        }),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.profileSaveError")));
        return;
      }

      clearDraft();
      setDirty(false);
      setSuccess(t("onboarding.personalStepSaved"));
      setStep(kind === "seller" ? "product" : "sourcing");
    } catch {
      setError(t("settings.profileSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function saveProductStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (!product.images.length) {
      setError(t("listing.errors.images"));
      return;
    }
    if (!product.name.trim()) {
      setError(t("listing.errors.name"));
      return;
    }
    if (!product.category) {
      setError(t("listing.errors.category"));
      return;
    }
    if (!product.detailedDescription.trim()) {
      setError(t("listing.errors.description"));
      return;
    }
    if (!product.priceMin || Number(product.priceMin) <= 0) {
      setError(t("listing.errors.price"));
      return;
    }
    if (
      product.moqUnit !== "Not fixed" &&
      (!product.moqQuantity || Number(product.moqQuantity) <= 0)
    ) {
      setError(t("listing.errors.moq"));
      return;
    }
    if (!product.leadTime) {
      setError(t("listing.errors.leadTime"));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = productPayloadFromForm(product);
      const response = await fetch("/api/account/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          tags: product.tags ? payload.tags : list(company.categories),
          status: "active",
        }),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.productSaveError")));
        return;
      }
      await completeOnboarding("/dashboard/seller");
    } catch {
      setError(t("settings.productSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function saveSourcingStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (!sourcing.interestedCategories.trim()) {
      setError(t("onboarding.sourcingCategoriesRequired"));
      return;
    }
    if (!sourcing.expectedOrderRange.trim()) {
      setError(t("onboarding.expectedOrderRequired"));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyPayload(true)),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.companySaveError")));
        return;
      }
      await completeOnboarding("/dashboard/buyer");
    } catch {
      setError(t("settings.companySaveError"));
    } finally {
      setSaving(false);
    }
  }

  function companyPayload(includeBuyerPreferences = false) {
    const categories =
      kind === "buyer" && includeBuyerPreferences
        ? list(sourcing.interestedCategories)
        : list(company.categories);
    return {
      companyRole: kind,
      legalName: company.companyName,
      tradeName: "",
      logoOriginalUrl: company.logoOriginalUrl,
      logoThumbnailUrl: company.logoThumbnailUrl,
      logoUrl: company.logoUrl,
      useDefaultLogo: !company.logoUrl,
      website: company.website,
      country: kind === "seller" ? SOUTH_KOREA : UNITED_STATES,
      city: company.city,
      stateOrProvince: kind === "buyer" ? company.stateOrProvince : "",
      businessAddress: "",
      description: company.description,
      categories,
      sellerProfile:
        kind === "seller"
          ? {
              koreanBusinessRegistrationNumber: "",
              representativeName: personal.displayName,
              exportExperience: company.description,
              exportCountries: ["United States"],
              productCategories: categories,
              minimumOrderQuantity: productPayloadFromForm(product).moq,
              leadTime: product.leadTime,
              certifications: [],
              shippingTerms: [],
              paymentTerms: [],
              factoryOrDistributorStatus: company.companyType,
            }
          : undefined,
      buyerProfile:
        kind === "buyer"
          ? {
              buyerType: company.companyType,
              purchasingCategories: categories,
              preferredSupplierType: sourcing.preferredSupplierType,
              targetOrderSize: sourcing.expectedOrderRange,
              monthlyImportVolume: sourcing.importVolume,
              importExperience: sourcing.importExperience,
              salesChannels: list(sourcing.salesChannels),
              purchaseTimeline: sourcing.purchaseTimeline,
            }
          : undefined,
    };
  }

  async function completeOnboarding(target: string) {
    const response = await fetch("/api/user/onboarding", { method: "POST" });
    if (!response.ok) {
      setError(await readJsonError(response, t("onboarding.completeError")));
      return;
    }
    clearDraft();
    setDirty(false);
    router.push(withLocale(target, locale));
  }

  return (
    <div className="grid gap-6">
      <OnboardingStepper
        current={stepToId(step)}
        role={kind}
        onSelect={selectStep}
      />
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <OnboardingGuide kind={kind} />
        <div className="grid gap-5">
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

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}

          {step === "company" ? (
            <CompanyStepForm
              kind={kind}
              company={company}
              saving={saving}
              uploading={uploading}
              privateDocument={privateDocument}
              onSubmit={saveCompanyStep}
              onChange={updateCompany}
              onLogoUploaded={updateCompanyLogo}
              onPrivateDocument={(file) => {
                setPrivateDocument(file);
                updateCompany("certificateFileName", file?.name ?? "");
              }}
              onUploadingChange={setUploading}
            />
          ) : null}

          {step === "personal" ? (
            <PersonalStepForm
              personal={personal}
              saving={saving}
              uploading={uploading}
              onSubmit={savePersonalStep}
              onChange={updatePersonal}
              onUploadingChange={setUploading}
            />
          ) : null}

          {step === "product" ? (
            <ProductStepForm
              product={product}
              saving={saving}
              uploading={uploading}
              onSubmit={saveProductStep}
              onChange={updateProduct}
              onUploadingChange={setUploading}
            />
          ) : null}

          {step === "sourcing" ? (
            <SourcingStepForm
              sourcing={sourcing}
              saving={saving}
              onSubmit={saveSourcingStep}
              onChange={updateSourcing}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompanyStepForm({
  kind,
  company,
  saving,
  uploading,
  privateDocument,
  onSubmit,
  onChange,
  onLogoUploaded,
  onPrivateDocument,
  onUploadingChange,
}: {
  kind: "buyer" | "seller";
  company: CompanyStep;
  saving: boolean;
  uploading: boolean;
  privateDocument: File | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof CompanyStep>(key: K, value: CompanyStep[K]) => void;
  onLogoUploaded: (image: UploadedListingImage) => void;
  onPrivateDocument: (file: File | null) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const companyTypeOptions =
    kind === "seller"
      ? getSellerCompanyTypeOptions(locale)
      : getBuyerTypeOptions(locale);
  const countryValue = kind === "seller" ? SOUTH_KOREA : UNITED_STATES;
  const companyLogoPreviewUrl =
    company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl;

  return (
    <form
      onSubmit={onSubmit}
      className="bm-premium-card grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100"
      noValidate
    >
      <StepHeading
        title={t("onboarding.companyStepTitle")}
        description={
          kind === "seller"
            ? t("onboarding.sellerCompanyStepText")
            : t("onboarding.buyerCompanyStepText")
        }
      />
      <SingleImageUploader
        kind="company_logo"
        imageUrl={companyLogoPreviewUrl}
        imageUrls={[
          company.logoThumbnailUrl,
          company.logoUrl,
          company.logoOriginalUrl,
        ]}
        label={t("settings.companyLogoUpload")}
        onUploaded={onLogoUploaded}
        onUploadingChange={onUploadingChange}
        circular={false}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("onboarding.companyName")}
          value={company.companyName}
          onChange={(value) => onChange("companyName", value)}
          required
        />
        <Field
          label={t("settings.website")}
          type="url"
          value={company.website}
          onChange={(value) => onChange("website", value)}
        />
        <SelectField
          label={t("settings.country")}
          value={countryValue}
          onChange={() => onChange("country", countryValue)}
          options={[{ value: countryValue, label: countryValue }]}
          required
          disabled
        />
        {kind === "buyer" ? (
          <>
            <Field
              label={t("settings.city")}
              value={company.city}
              onChange={(value) => onChange("city", value)}
              required
            />
            <SelectField
              label={t("settings.state")}
              value={company.stateOrProvince}
              onChange={(value) => onChange("stateOrProvince", value)}
              options={getUsStateOptions(locale)}
              placeholder={t("settings.selectState")}
              required
            />
          </>
        ) : (
          <SelectField
            label={t("settings.cityRegion")}
            value={company.city}
            onChange={(value) => onChange("city", value)}
            options={getKoreanRegionOptions(locale)}
            placeholder={t("settings.selectCityRegion")}
            required
          />
        )}
        <SelectField
          label={kind === "seller" ? t("settings.supplierType") : t("settings.buyerType")}
          value={company.companyType}
          onChange={(value) => onChange("companyType", value)}
          options={companyTypeOptions}
          required
        />
        {kind === "seller" ? (
          <CheckboxGroup
            label={t("settings.categories")}
            values={list(company.categories)}
            onChange={(values) => onChange("categories", joined(values))}
            options={getSellerProductCategoryOptions(locale)}
            className="sm:col-span-2"
          />
        ) : null}
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">
            {t("settings.companyDescription")}
          </span>
          <textarea
            rows={5}
            value={company.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="rounded-md border border-zinc-200 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">
            {t("onboarding.privateBusinessDocument")}
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) =>
              onPrivateDocument(event.target.files?.[0] ?? null)
            }
            className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-700 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm"
          />
          <span className="text-xs leading-5 text-zinc-500">
            {privateDocument?.name || company.certificateFileName
              ? privateDocument?.name || company.certificateFileName
              : t("onboarding.privateDocumentNotice")}
          </span>
        </label>
      </div>
      <SubmitButton
        saving={saving}
        uploading={uploading}
        label={t("onboarding.saveAndContinue")}
      />
    </form>
  );
}

function PersonalStepForm({
  personal,
  saving,
  uploading,
  onSubmit,
  onChange,
  onUploadingChange,
}: {
  personal: PersonalStep;
  saving: boolean;
  uploading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof PersonalStep>(key: K, value: PersonalStep[K]) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <form
      onSubmit={onSubmit}
      className="bm-premium-card grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100"
      noValidate
    >
      <StepHeading
        title={t("onboarding.personalStepTitle")}
        description={t("onboarding.personalStepText")}
      />
      <SingleImageUploader
        kind="profile_avatar"
        imageUrl={personal.avatarUrl}
        label={t("settings.avatarUpload")}
        onUploaded={(image) => {
          onChange("avatarOriginalUrl", image.originalUrl);
          onChange("avatarUrl", image.mainUrl);
        }}
        onUploadingChange={onUploadingChange}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("settings.displayName")}
          value={personal.displayName}
          onChange={(value) => onChange("displayName", value)}
          required
        />
        <Field
          label={t("contact.email")}
          type="email"
          value={personal.email}
          onChange={(value) => onChange("email", value)}
        />
        <Field
          label={t("settings.jobTitle")}
          value={personal.jobTitle}
          onChange={(value) => onChange("jobTitle", value)}
        />
        <Field
          label={t("settings.department")}
          value={personal.department}
          onChange={(value) => onChange("department", value)}
        />
        <Field
          label={t("settings.phoneNumber")}
          type="tel"
          value={personal.phoneNumber}
          onChange={(value) => onChange("phoneNumber", value)}
        />
        <Field
          label={t("settings.linkedinUrl")}
          type="url"
          value={personal.linkedinUrl}
          onChange={(value) => onChange("linkedinUrl", value)}
        />
      </div>
      <SubmitButton
        saving={saving}
        uploading={uploading}
        label={t("onboarding.saveAndContinue")}
      />
    </form>
  );
}

function ProductStepForm({
  product,
  saving,
  uploading,
  onSubmit,
  onChange,
  onUploadingChange,
}: {
  product: SellerProductStep;
  saving: boolean;
  uploading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof SellerProductStep>(
    key: K,
    value: SellerProductStep[K],
  ) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const { t } = useI18n();
  const [fieldErrors, setFieldErrors] = useState<RichProductFormErrors>({});

  function update<K extends keyof SellerProductStep>(key: K, value: SellerProductStep[K]) {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    onChange(key, value);
  }

  return (
    <form
      onSubmit={(event) => {
        const nextErrors: RichProductFormErrors = {};
        if (!product.images.length) nextErrors.images = t("listing.errors.images");
        if (!product.name.trim()) nextErrors.name = t("listing.errors.name");
        if (!product.category) nextErrors.category = t("listing.errors.category");
        if (!product.priceMin || Number(product.priceMin) <= 0) {
          nextErrors.price = t("listing.errors.price");
        }
        if (
          product.moqUnit !== "Not fixed" &&
          (!product.moqQuantity || Number(product.moqQuantity) <= 0)
        ) {
          nextErrors.moq = t("listing.errors.moq");
        }
        if (!product.leadTime) nextErrors.leadTime = t("listing.errors.leadTime");
        if (!product.detailedDescription.trim()) {
          nextErrors.description = t("listing.errors.description");
        }
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="bm-premium-card grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100"
      noValidate
    >
      <StepHeading
        title={t("onboarding.productStepTitle")}
        description={t("onboarding.productStepText")}
      />
      <RichProductFormFields
        value={product}
        errors={fieldErrors}
        onChange={update}
        onUploadingChange={onUploadingChange}
      />
      <SubmitButton
        saving={saving}
        uploading={uploading}
        label={t("onboarding.finishOnboarding")}
      />
    </form>
  );
}

function SourcingStepForm({
  sourcing,
  saving,
  onSubmit,
  onChange,
}: {
  sourcing: BuyerSourcingStep;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof BuyerSourcingStep>(
    key: K,
    value: BuyerSourcingStep[K],
  ) => void;
}) {
  const { locale, t } = useI18n();

  return (
    <form
      onSubmit={onSubmit}
      className="bm-premium-card grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100"
      noValidate
    >
      <StepHeading
        title={t("onboarding.sourcingStepTitle")}
        description={t("onboarding.sourcingStepText")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CheckboxGroup
          label={t("onboarding.interestedKoreanCategories")}
          values={list(sourcing.interestedCategories)}
          onChange={(values) => onChange("interestedCategories", joined(values))}
          options={getBuyerCategoryOptions(locale)}
          className="sm:col-span-2"
          required
        />
        <SelectField
          label={t("onboarding.preferredSupplierType")}
          value={sourcing.preferredSupplierType}
          onChange={(value) => onChange("preferredSupplierType", value)}
          options={getSupplierTypeOptions(locale)}
          placeholder={t("onboarding.select")}
        />
        <SelectField
          label={t("onboarding.expectedOrderRange")}
          value={sourcing.expectedOrderRange}
          onChange={(value) => onChange("expectedOrderRange", value)}
          options={getOrderSizeOptions(locale)}
          placeholder={t("onboarding.select")}
          required
        />
        <SelectField
          label={t("settings.monthlyImportVolume")}
          value={sourcing.importVolume}
          onChange={(value) => onChange("importVolume", value)}
          options={getImportVolumeOptions(locale)}
          placeholder={t("onboarding.select")}
        />
        <SelectField
          label={t("settings.importExperience")}
          value={sourcing.importExperience}
          onChange={(value) => onChange("importExperience", value)}
          options={getImportExperienceOptions(locale)}
          placeholder={t("onboarding.select")}
        />
        <SelectField
          label={t("settings.purchaseTimeline")}
          value={sourcing.purchaseTimeline}
          onChange={(value) => onChange("purchaseTimeline", value)}
          options={getSourcingTimelineOptions(locale)}
          placeholder={t("onboarding.select")}
        />
        <CheckboxGroup
          label={t("settings.salesChannels")}
          values={list(sourcing.salesChannels)}
          onChange={(values) => onChange("salesChannels", joined(values))}
          options={getSalesChannelOptions(locale)}
          className="sm:col-span-2"
        />
        <Field
          label={t("onboarding.messagePreference")}
          value={sourcing.messagePreference}
          onChange={(value) => onChange("messagePreference", value)}
        />
      </div>
      <SubmitButton saving={saving} uploading={false} label={t("onboarding.finishOnboarding")} />
    </form>
  );
}

function OnboardingGuide({ kind }: { kind: "buyer" | "seller" }) {
  const { t } = useI18n();
  const steps = [
    t("onboarding.stepRole"),
    t("onboarding.stepCompany"),
    t("onboarding.stepPersonal"),
    kind === "seller"
      ? t("onboarding.stepSellerProduct")
      : t("onboarding.stepBuyerSourcing"),
  ];

  return (
    <aside className="bm-premium-card grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
      <div className="relative z-10">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Trade82
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-950">
          {t("onboarding.processTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t("onboarding.processText")}
        </p>
      </div>

      <ol className="relative z-10 grid gap-3">
        {steps.map((item, index) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm text-zinc-700 transition hover:border-blue-100 hover:bg-white"
          >
            <span className="flex size-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800">
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>

      <div className="relative z-10">
        <ProfilePreviewPanel
          kind={kind}
          title={t("onboarding.previewTitle")}
          subtitle={t("onboarding.previewText")}
          badgeLabel={
            kind === "seller" ? t("roles.koreanSeller") : t("roles.americanBuyer")
          }
        />
      </div>
    </aside>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

function SubmitButton({
  saving,
  uploading,
  label,
}: {
  saving: boolean;
  uploading: boolean;
  label: string;
}) {
  const { t } = useI18n();

  return (
    <button
      type="submit"
      disabled={saving || uploading}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-75 sm:w-fit"
    >
      {uploading ? t("listing.uploading") : saving ? t("settings.saving") : label}
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  label,
  values,
  onChange,
  options,
  className,
  required = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  className?: string;
  required?: boolean;
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
      <legend className="font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </legend>
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
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "number";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
