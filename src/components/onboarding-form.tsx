"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  SingleImageUploader,
} from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import {
  OnboardingStepper,
  type OnboardingStepId,
} from "@/components/onboarding-stepper";
import {
  emptyRichProductForm,
  productPayloadFromForm,
  RichProductFormFields,
  type RichProductFormErrors,
  type RichProductFormValue,
  validateRichProductForm,
} from "@/components/rich-product-form-fields";
import {
  useDraftBackup,
  useUnsavedChangesWarning,
} from "@/hooks/use-form-reliability";
import {
  rememberAccountCompany,
  type AccountCompanyRecord,
} from "@/hooks/use-account-companies";
import {
  getBuyerCategoryOptions,
  getBuyerTypeOptions,
  getCountryOptions,
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
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  avatarOriginalUrl: string;
  avatarUrl: string;
  jobTitle: string;
  department: string;
  phoneNumber: string;
  linkedinUrl: string;
  acceptedTerms: boolean;
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
    country: kind === "seller" ? SOUTH_KOREA : "",
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
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  avatarOriginalUrl: "",
  avatarUrl: "",
  jobTitle: "",
  department: "",
  phoneNumber: "",
  linkedinUrl: "",
  acceptedTerms: false,
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
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
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
  const [buyerSubmitted, setBuyerSubmitted] = useState(false);
  const [buyerKeywordInput, setBuyerKeywordInput] = useState("");
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
    dirty && !saving,
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
    setCompany((current) => {
      const nextCompany = {
        ...current,
        ...nextLogo,
      };
      if (user?.id) {
        rememberAccountCompany(user.id, {
          id: companyId || `draft-${kind}`,
          companyRole: kind,
          legalName: nextCompany.companyName,
          tradeName: "",
          logoOriginalUrl: nextCompany.logoOriginalUrl,
          logoThumbnailUrl: nextCompany.logoThumbnailUrl,
          logoUrl: nextCompany.logoUrl,
          useDefaultLogo: false,
          website: nextCompany.website,
          country: kind === "seller" ? SOUTH_KOREA : nextCompany.country,
          city: nextCompany.city,
          stateOrProvince: nextCompany.stateOrProvince,
          description: nextCompany.description,
          categories: list(nextCompany.categories),
          updatedAt: new Date().toISOString(),
        });
      }
      return nextCompany;
    });
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

  const buyerKeywords = useMemo(
    () => list(sourcing.messagePreference),
    [sourcing.messagePreference],
  );

  function addBuyerKeyword(rawValue: string) {
    const cleaned = rawValue.trim().replace(/,$/, "");
    if (!cleaned) return;
    const existing = new Set(buyerKeywords.map((keyword) => keyword.toLowerCase()));
    if (existing.has(cleaned.toLowerCase())) {
      setBuyerKeywordInput("");
      return;
    }
    updateSourcing("messagePreference", joined([...buyerKeywords, cleaned]));
    setBuyerKeywordInput("");
  }

  function removeBuyerKeyword(keyword: string) {
    updateSourcing(
      "messagePreference",
      joined(buyerKeywords.filter((item) => item !== keyword)),
    );
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
    if (kind === "seller" && !company.city.trim()) {
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

      const savedCompany = (await response.json()) as AccountCompanyRecord & {
        id: string;
      };
      setCompanyId(savedCompany.id);
      if (user?.id) {
        rememberAccountCompany(user.id, savedCompany);
      }

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
          country: kind === "seller" ? SOUTH_KOREA : company.country,
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
    if (saving) return;
    const nextErrors = validateRichProductForm(product, t);
    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      setError(firstError);
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

  function buyerSignupErrors() {
    const errors: Record<string, string> = {};
    const email = personal.email.trim();
    if (!email) {
      errors.email = t("onboarding.workEmailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t("onboarding.workEmailInvalid");
    }
    if (!personal.firstName.trim()) errors.firstName = t("onboarding.firstNameRequired");
    if (!personal.lastName.trim()) errors.lastName = t("onboarding.lastNameRequired");
    if (!company.companyName.trim()) errors.companyName = t("onboarding.companyNameRequired");
    if (!personal.phoneNumber.trim()) errors.phoneNumber = t("onboarding.companyTelRequired");
    if (!company.companyType.trim()) errors.companyType = t("onboarding.signUpPathRequired");
    if (!list(sourcing.interestedCategories).length) {
      errors.categories = t("onboarding.productTypesRequired");
    }
    if (!buyerKeywords.length) errors.keywords = t("onboarding.keywordsRequired");
    if (!personal.acceptedTerms) errors.terms = t("onboarding.termsRequired");
    return errors;
  }

  async function saveBuyerSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    setBuyerSubmitted(true);
    const nextErrors = buyerSignupErrors();
    if (Object.keys(nextErrors).length) {
      setError(t("onboarding.buyerSignupFixErrors"));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const displayName = `${personal.firstName.trim()} ${personal.lastName.trim()}`.trim();
    const categories = list(sourcing.interestedCategories);
    const keywords = buyerKeywords;

    try {
      const profileResponse = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email: personal.email,
          companyAffiliation: company.companyName,
          phoneNumber: personal.phoneNumber,
          country: company.country,
          city: "",
          preferredLanguage: locale,
        }),
      });
      if (!profileResponse.ok) {
        setError(await readJsonError(profileResponse, t("settings.profileSaveError")));
        return;
      }

      const companyResponse = await fetch("/api/account/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyRole: "buyer",
          legalName: company.companyName,
          tradeName: "",
          logoOriginalUrl: company.logoOriginalUrl,
          logoThumbnailUrl: company.logoThumbnailUrl,
          logoUrl: company.logoUrl,
          useDefaultLogo: !company.logoUrl,
          website: "",
          country: company.country,
          city: "",
          stateOrProvince: "",
          businessAddress: "",
          description: keywords.length
            ? `Interested keywords: ${joined(keywords)}`
            : "",
          categories,
          buyerProfile: {
            buyerType: company.companyType,
            purchasingCategories: categories,
            preferredSupplierType: "",
            targetOrderSize: "",
            monthlyImportVolume: "",
            importExperience: "",
            salesChannels: [],
            purchaseTimeline: "",
          },
        }),
      });
      if (!companyResponse.ok) {
        setError(await readJsonError(companyResponse, t("settings.companySaveError")));
        return;
      }

      const savedCompany = (await companyResponse.json()) as AccountCompanyRecord & {
        id: string;
      };
      setCompanyId(savedCompany.id);
      if (user?.id) {
        rememberAccountCompany(user.id, savedCompany);
      }
      setPersonal((current) => ({ ...current, displayName }));
      clearDraft();
      setDirty(false);
      setSuccess(t("onboarding.profileSavedText"));
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
      country: kind === "seller" ? SOUTH_KOREA : company.country,
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
              exportCountries: [],
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

  if (kind === "buyer") {
    const buyerErrors = buyerSubmitted ? buyerSignupErrors() : {};

    return (
      <div
        id="onboarding-current-step"
        className="mx-auto grid w-full max-w-[860px] scroll-mt-28 gap-5"
      >
        {draft ? (
          <div className="rounded-xl border p-4 text-sm theme-warning-badge">
            <p>{t("settings.draftAvailable")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="rounded-lg px-3 py-2 font-medium theme-primary"
              >
                {t("settings.restoreDraft")}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="rounded-lg border px-3 py-2 font-medium theme-surface"
              >
                {t("settings.discardDraft")}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border px-4 py-3 text-sm theme-danger-badge">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl border px-4 py-3 text-sm theme-success-badge">
            {success}
          </p>
        ) : null}

        <BuyerQuickSignupForm
          company={company}
          personal={personal}
          sourcing={sourcing}
          keywords={buyerKeywords}
          keywordInput={buyerKeywordInput}
          errors={buyerErrors}
          saving={saving}
          onSubmit={saveBuyerSignup}
          onCompanyChange={updateCompany}
          onPersonalChange={updatePersonal}
          onSourcingChange={updateSourcing}
          onKeywordInputChange={setBuyerKeywordInput}
          onAddKeyword={addBuyerKeyword}
          onRemoveKeyword={removeBuyerKeyword}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-5">
      <OnboardingStepper
        current={stepToId(step)}
        role={kind}
        onSelect={selectStep}
      />
      <div id="onboarding-current-step" className="scroll-mt-28 grid gap-5">
          {draft ? (
            <div className="rounded-xl border p-4 text-sm theme-warning-badge">
              <p>{t("settings.draftAvailable")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="rounded-lg px-3 py-2 font-medium theme-primary"
                >
                  {t("settings.restoreDraft")}
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="rounded-lg border px-3 py-2 font-medium theme-surface"
                >
                  {t("settings.discardDraft")}
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border px-4 py-3 text-sm theme-danger-badge">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-xl border px-4 py-3 text-sm theme-success-badge">
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
  );
}

function BuyerQuickSignupForm({
  company,
  personal,
  sourcing,
  keywords,
  keywordInput,
  errors,
  saving,
  onSubmit,
  onCompanyChange,
  onPersonalChange,
  onSourcingChange,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
}: {
  company: CompanyStep;
  personal: PersonalStep;
  sourcing: BuyerSourcingStep;
  keywords: string[];
  keywordInput: string;
  errors: Record<string, string>;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCompanyChange: <K extends keyof CompanyStep>(key: K, value: CompanyStep[K]) => void;
  onPersonalChange: <K extends keyof PersonalStep>(key: K, value: PersonalStep[K]) => void;
  onSourcingChange: <K extends keyof BuyerSourcingStep>(
    key: K,
    value: BuyerSourcingStep[K],
  ) => void;
  onKeywordInputChange: (value: string) => void;
  onAddKeyword: (value: string) => void;
  onRemoveKeyword: (value: string) => void;
}) {
  const { locale, t } = useI18n();
  const selectedCategories = list(sourcing.interestedCategories);
  const categoryOptions = getBuyerCategoryOptions(locale);
  const buyerTypeOptions = getBuyerTypeOptions(locale);
  const countryOptions = getCountryOptions(locale);

  function toggleCategory(value: string) {
    const next = new Set(selectedCategories);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSourcingChange("interestedCategories", joined(Array.from(next)));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
      noValidate
    >
      <div className="flex flex-col gap-2 border-b pb-5 theme-border">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
          {t("onboarding.buyerQuickLabel")}
        </p>
        <h2 className="text-xl font-semibold theme-foreground">
          {t("onboarding.buyerQuickTitle")}
        </h2>
        <p className="max-w-2xl text-sm leading-6 theme-muted">
          {t("onboarding.buyerQuickDescription")}
        </p>
      </div>

      <BuyerFormSection
        title={t("onboarding.accountContact")}
        description={t("onboarding.accountContactHelp")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <BuyerInput
            label={t("onboarding.workEmail")}
            type="email"
            value={personal.email}
            onChange={(value) => onPersonalChange("email", value)}
            error={errors.email}
            required
          />
          <BuyerInput
            label={t("settings.phoneNumber")}
            type="tel"
            value={personal.phoneNumber}
            onChange={(value) => onPersonalChange("phoneNumber", value)}
            error={errors.phoneNumber}
            required
          />
          <BuyerInput
            label={t("onboarding.firstName")}
            value={personal.firstName}
            onChange={(value) => onPersonalChange("firstName", value)}
            error={errors.firstName}
            required
          />
          <BuyerInput
            label={t("onboarding.lastName")}
            value={personal.lastName}
            onChange={(value) => onPersonalChange("lastName", value)}
            error={errors.lastName}
            required
          />
        </div>
      </BuyerFormSection>

      <BuyerFormSection
        title={t("onboarding.companyInformation")}
        description={t("onboarding.companyInformationHelp")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <BuyerInput
            label={t("onboarding.companyName")}
            value={company.companyName}
            onChange={(value) => onCompanyChange("companyName", value)}
            error={errors.companyName}
            required
          />
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium theme-foreground">
              {t("onboarding.signUpPath")} <span className="text-red-300">*</span>
            </span>
            <select
              value={company.companyType}
              onChange={(event) => onCompanyChange("companyType", event.target.value)}
              className="h-11 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            >
              {buyerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.companyType ? (
              <span className="text-xs text-red-300">{errors.companyType}</span>
            ) : null}
          </label>
          <SelectField
            label={t("settings.country")}
            value={company.country}
            onChange={(value) => onCompanyChange("country", value)}
            options={countryOptions}
            placeholder={t("onboarding.select")}
          />
        </div>
      </BuyerFormSection>

      <BuyerFormSection
        title={t("onboarding.productInterests")}
        description={t("onboarding.productInterestsHelp")}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {categoryOptions.map((option) => {
            const selected = selectedCategories.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleCategory(option.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "theme-success-badge"
                    : "theme-surface theme-card-hover"
                }`}
                aria-pressed={selected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.categories ? (
          <p className="text-xs text-red-300">{errors.categories}</p>
        ) : null}
        <p className="text-xs leading-5 theme-muted">
          {t("onboarding.productTypesHelp")}
        </p>

        <div className="grid gap-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium theme-foreground">
              {t("onboarding.interestedKeywords")}{" "}
              <span className="text-red-300">*</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                placeholder={t("onboarding.keywordPlaceholder")}
                onChange={(event) => onKeywordInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    onAddKeyword(keywordInput);
                  }
                }}
                className="h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
              <button
                type="button"
                onClick={() => onAddKeyword(keywordInput)}
                className="inline-flex h-11 items-center rounded-xl border px-3 text-sm font-semibold transition theme-surface-muted hover:bg-[var(--muted)]"
              >
                {t("onboarding.addKeyword")}
              </button>
            </div>
          </label>
          {keywords.length ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => onRemoveKeyword(keyword)}
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium theme-success-badge"
                  aria-label={t("onboarding.removeKeyword")}
                >
                  {keyword}
                  <span aria-hidden="true">x</span>
                </button>
              ))}
            </div>
          ) : null}
          {errors.keywords ? (
            <p className="text-xs text-red-300">{errors.keywords}</p>
          ) : null}
          <p className="text-xs leading-5 theme-muted">
            {t("onboarding.keywordsHelp")}
          </p>
        </div>
      </BuyerFormSection>

      <BuyerFormSection
        title={t("onboarding.agreement")}
        description={t("onboarding.agreementHelp")}
      >
        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6 theme-surface-muted">
          <input
            type="checkbox"
            checked={personal.acceptedTerms}
            onChange={(event) => onPersonalChange("acceptedTerms", event.target.checked)}
            className="mt-1 size-4 rounded theme-input"
          />
          <span>
            {t("onboarding.acceptLegalPrefix")}{" "}
            <Link className="font-medium theme-success-text hover:underline" href={withLocale("/terms", locale)}>
              {t("footer.legalLinks.0.label")}
            </Link>{" "}
            {t("onboarding.and")}{" "}
            <Link className="font-medium theme-success-text hover:underline" href={withLocale("/privacy", locale)}>
              {t("footer.legalLinks.2.label")}
            </Link>
            .
          </span>
        </label>
        {errors.terms ? <p className="text-xs text-red-300">{errors.terms}</p> : null}
      </BuyerFormSection>

      <div className="flex flex-col gap-3 border-t pt-5 theme-border sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 theme-muted">
          {t("onboarding.authSeparateNotice")}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition theme-primary hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? t("settings.saving") : t("onboarding.saveBuyer")}
        </button>
      </div>
    </form>
  );
}

function BuyerFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border p-4 theme-surface">
      <div>
        <h3 className="text-base font-semibold theme-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 theme-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function BuyerInput({
  label,
  value,
  onChange,
  type = "text",
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
      />
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
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
  const countryOptions = getCountryOptions(locale);
  const countryValue = kind === "seller" ? SOUTH_KOREA : company.country;
  const companyLogoImageUrls = useMemo(
    () =>
      [
        company.logoThumbnailUrl,
        company.logoUrl,
        company.logoOriginalUrl,
      ].filter((url): url is string => Boolean(url?.trim())),
    [company.logoOriginalUrl, company.logoThumbnailUrl, company.logoUrl],
  );
  const companyLogoPreviewUrl = companyLogoImageUrls[0] ?? "";

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
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
        imageUrls={companyLogoImageUrls}
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
          onChange={(value) => onChange("country", value)}
          options={
            kind === "seller"
              ? [{ value: SOUTH_KOREA, label: SOUTH_KOREA }]
              : countryOptions
          }
          placeholder={kind === "buyer" ? t("onboarding.select") : undefined}
          required={kind === "seller"}
          disabled={kind === "seller"}
        />
        {kind === "buyer" ? (
          <>
            <Field
              label={t("settings.city")}
              value={company.city}
              onChange={(value) => onChange("city", value)}
            />
            {countryValue === UNITED_STATES ? (
              <SelectField
                label={t("settings.state")}
                value={company.stateOrProvince}
                onChange={(value) => onChange("stateOrProvince", value)}
                options={getUsStateOptions(locale)}
                placeholder={t("settings.selectState")}
              />
            ) : (
              <Field
                label={t("settings.stateProvince")}
                value={company.stateOrProvince}
                onChange={(value) => onChange("stateOrProvince", value)}
              />
            )}
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
          <span className="font-medium theme-foreground">
            {t("settings.companyDescription")}
          </span>
          <textarea
            rows={5}
            value={company.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium theme-foreground">
            {t("onboarding.privateBusinessDocument")}
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(event) =>
              onPrivateDocument(event.target.files?.[0] ?? null)
            }
            className="block w-full rounded-xl border px-3 py-2 text-sm theme-input file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--muted)] file:px-3 file:py-1 file:text-sm file:text-[var(--foreground)]"
          />
          <span className="text-xs leading-5 theme-muted">
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
      className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
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
    setFieldErrors((current) =>
      key === "fieldVisibility" ? {} : { ...current, [key]: undefined },
    );
    onChange(key, value);
  }

  return (
    <form
      onSubmit={(event) => {
        const nextErrors = validateRichProductForm(product, t);
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
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
        variant="dashboard"
      />
      <SubmitButton
        saving={saving}
        uploading={false}
        label={t("onboarding.finishOnboarding")}
      />
      {uploading ? (
        <p role="status" className="text-sm theme-info-text">
          {t("listing.imageUploadInProgress")}
        </p>
      ) : null}
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
      className="grid gap-5 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
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

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold theme-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
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
      className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition theme-primary hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-wait disabled:opacity-75 sm:w-fit"
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
      <span className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70"
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
      <legend className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </legend>
      <div className="grid gap-2 rounded-xl border p-3 theme-surface sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 theme-foreground">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="size-4 rounded theme-input"
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
      <span className="font-medium theme-foreground">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border px-3 text-sm outline-none transition theme-input focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
      />
    </label>
  );
}
