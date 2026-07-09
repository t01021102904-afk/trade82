"use client";

import { useUser } from "@clerk/nextjs";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  getCountryOptions,
  getKoreanRegionOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getSellerProductCategoryOptions,
  getSellerSupplierTypeOptions,
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
  accountProfile: AccountProfileForSettings;
};

type CompanyDraft = LoadedCompanyProfile;

type CompanyRecord = AccountCompanyRecord;

type AccountProfileForSettings = {
  displayName: string;
  email: string;
  avatarOriginalUrl: string;
  avatarUrl: string;
  phoneNumber: string;
  country: string;
  city: string;
  role: "user" | "seller" | "buyer" | "both" | "admin" | null;
};

const companyFormSnapshots = new Map<string, CompanyDraft>();

function companySnapshotKey(ownerUserId: string, role: "seller" | "buyer") {
  return `${ownerUserId}:${role}`;
}

function normalizeAccountRole(value: unknown): AccountProfileForSettings["role"] {
  return value === "user" ||
    value === "seller" ||
    value === "buyer" ||
    value === "both" ||
    value === "admin"
    ? value
    : null;
}

function companyRoleFromAccountRole(
  role: AccountProfileForSettings["role"],
): "seller" | "buyer" | null {
  if (role === "seller" || role === "both") return "seller";
  if (role === "buyer") return "buyer";
  return null;
}

function inferCompanyRoleFromCompanies(companies: CompanyRecord[]) {
  if (companies.some((company) => company.companyRole === "seller")) {
    return "seller" as const;
  }
  if (companies.some((company) => company.companyRole === "buyer")) {
    return "buyer" as const;
  }
  return null;
}

function isPersonalBuyerCompanyName(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "personal";
}

function buildAccountProfile(
  stored: Record<string, unknown> | null,
  fallback: {
    displayName: string;
    email: string;
    avatarUrl: string;
  },
): AccountProfileForSettings {
  return {
    displayName: String(stored?.displayName ?? fallback.displayName),
    email: String(stored?.email ?? fallback.email),
    avatarOriginalUrl: String(stored?.avatarOriginalUrl ?? ""),
    avatarUrl: String(stored?.avatarUrl ?? fallback.avatarUrl),
    phoneNumber: String(stored?.phoneNumber ?? ""),
    country: String(stored?.country ?? ""),
    city: String(stored?.city ?? ""),
    role: normalizeAccountRole(stored?.role),
  };
}

async function loadAccountProfile() {
  const response = await fetch("/api/account/profile", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}

function rememberCompanyFormSnapshot(key: string, draft: CompanyDraft) {
  companyFormSnapshots.set(key, draft);
  debugCompanyLogo("remembered company form snapshot", {
    key,
    companyId: draft.company.id,
    role: draft.company.companyRole,
    logoOriginalUrl: draft.company.logoOriginalUrl,
    logoThumbnailUrl: draft.company.logoThumbnailUrl,
    logoUrl: draft.company.logoUrl,
    useDefaultLogo: draft.company.useDefaultLogo,
    updatedAt: draft.company.updatedAt,
  });
}

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
  accountProfile: AccountProfileForSettings,
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
      country: String(
        stored?.country ?? (role === "seller" ? SOUTH_KOREA : ""),
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
        (role === "seller" ? "pending_review" : "verified"),
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
      exportCountries: (sellerProfile.exportCountries as string[]) ?? [],
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
    accountProfile,
  };
}

async function readJsonError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return result?.error ?? fallback;
}

const avatarAcceptedExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const avatarAcceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const avatarMaxBytes = 25 * 1024 * 1024;

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function avatarValidationError(file: File, locale: "en" | "ko") {
  if (file.size <= 0) {
    return locale === "ko"
      ? "빈 파일은 업로드할 수 없습니다."
      : "Empty files cannot be uploaded.";
  }
  if (
    !avatarAcceptedTypes.has(file.type.toLowerCase()) ||
    !avatarAcceptedExtensions.has(fileExtension(file))
  ) {
    return locale === "ko"
      ? "JPG, PNG, WebP 또는 AVIF 이미지만 업로드할 수 있습니다."
      : "Only JPG, PNG, WebP, or AVIF images can be uploaded.";
  }
  if (file.size > avatarMaxBytes) {
    return locale === "ko"
      ? "프로필 사진은 최대 25MB까지 업로드할 수 있습니다."
      : "Profile photos can be up to 25MB.";
  }
  return "";
}

function avatarUploadError(locale: "en" | "ko") {
  return locale === "ko"
    ? "프로필 사진 업로드에 실패했습니다. 다시 시도해 주세요."
    : "Profile photo upload failed. Please try again.";
}

async function uploadAvatarFile(file: File, locale: "en" | "ko") {
  const formData = new FormData();
  formData.set("uploadType", "profile_avatar");
  formData.set("file", file);

  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "x-trade82-locale": locale },
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as
      | (Partial<UploadedListingImage> & { error?: string })
      | null;

    if (
      response.ok &&
      result?.originalUrl &&
      result.cardUrl &&
      result.mainUrl &&
      result.detailUrl &&
      result.storagePath
    ) {
      return {
        ok: true as const,
        image: {
          originalUrl: result.originalUrl,
          cardUrl: result.cardUrl,
          mainUrl: result.mainUrl,
          detailUrl: result.detailUrl,
          storagePath: result.storagePath,
          width: result.width ?? null,
          height: result.height ?? null,
        },
      };
    }

    return {
      ok: false as const,
      error: result?.error ?? avatarUploadError(locale),
    };
  } catch {
    return { ok: false as const, error: avatarUploadError(locale) };
  }
}

export function CompanyProfileSettings() {
  const { isLoaded, user } = useUser();
  const { locale, t } = useI18n();
  const metadataRole = normalizeAccountRole(user?.publicMetadata.role);
  const userId = user?.id ?? "";
  const [loadedProfile, setLoadedProfile] =
    useState<LoadedCompanyProfile | null>(null);
  const [loadingComplete, setLoadingComplete] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    let cancelled = false;
    const fallbackProfile = {
      displayName:
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "Trade82 User",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
      avatarUrl: user?.imageUrl ?? "",
    };

    void Promise.all([
      loadAccountCompanies(userId, { force: true }),
      loadAccountProfile(),
    ])
      .then(([companies, accountRecord]: [CompanyRecord[], Record<string, unknown> | null]) => {
        if (cancelled) return;
        const accountProfile = buildAccountProfile(accountRecord, fallbackProfile);
        const dbCompanyRole = companyRoleFromAccountRole(accountProfile.role);
        const metadataCompanyRole = companyRoleFromAccountRole(metadataRole);
        const targetRole =
          dbCompanyRole ?? metadataCompanyRole ?? inferCompanyRoleFromCompanies(companies);
        if (!targetRole) {
          setLoadedProfile(null);
          setLoadingComplete(true);
          return;
        }
        const stored = companies.find((item) => item.companyRole === targetRole);
        debugCompanyLogo("loaded company profile", {
          role: targetRole,
          dbRole: accountProfile.role,
          metadataRole,
          companyId: stored?.id ?? null,
          logoOriginalUrl: stored?.logoOriginalUrl ?? null,
          logoThumbnailUrl: stored?.logoThumbnailUrl ?? null,
          logoUrl: stored?.logoUrl ?? null,
          useDefaultLogo: stored?.useDefaultLogo ?? null,
        });
        setLoadedProfile(
          buildCompanyProfile(stored, targetRole, userId, accountProfile),
        );
        setLoadingComplete(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedProfile(null);
        setLoadingComplete(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    metadataRole,
    user?.fullName,
    user?.imageUrl,
    user?.primaryEmailAddress?.emailAddress,
    userId,
  ]);

  if (
    loadingComplete &&
    user &&
    !loadedProfile
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
    !loadedProfile ||
    (isLoaded && !user) ||
    (isLoaded &&
      user &&
      loadedProfile.company.ownerClerkUserId !== user.id)
  ) {
    return <div className="text-sm text-zinc-600">{t("common.loading")}</div>;
  }

  return (
    <CompanyProfileForm
      role={loadedProfile.company.companyRole}
      initialCompany={loadedProfile.company}
      initialSeller={loadedProfile.seller}
      initialBuyer={loadedProfile.buyer}
      initialAccountProfile={loadedProfile.accountProfile}
    />
  );
}

function CompanyProfileForm({
  role,
  initialCompany,
  initialSeller,
  initialBuyer,
  initialAccountProfile,
}: {
  role: "seller" | "buyer";
  initialCompany: CompanyProfile;
  initialSeller: SellerCompanyProfile;
  initialBuyer: BuyerCompanyProfile;
  initialAccountProfile: AccountProfileForSettings;
}) {
  const { locale, t } = useI18n();
  const formSnapshotKey = companySnapshotKey(
    initialCompany.ownerClerkUserId,
    role,
  );
  const initialSnapshot = companyFormSnapshots.get(formSnapshotKey);
  const [company, setCompany] = useState(
    () => initialSnapshot?.company ?? initialCompany,
  );
  const [seller, setSeller] = useState(
    () => initialSnapshot?.seller ?? initialSeller,
  );
  const [buyer, setBuyer] = useState(
    () => initialSnapshot?.buyer ?? initialBuyer,
  );
  const [accountProfile, setAccountProfile] = useState(
    () => initialSnapshot?.accountProfile ?? initialAccountProfile,
  );
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveQueuedAfterUpload, setSaveQueuedAfterUpload] = useState(false);
  const [clearCompanyLogo, setClearCompanyLogo] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CompanyFormErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const buyerAvatarInputRef = useRef<HTMLInputElement>(null);
  const saveQueuedAfterUploadRef = useRef(false);
  const leaveMessage = t("settings.unsavedChangesWarning");
  useUnsavedChangesWarning(dirty && !isSaving && !isUploading, leaveMessage);
  const { draft, clearDraft, discardDraft } = useDraftBackup<CompanyDraft>(
    `bridgemarket:company-draft:${initialCompany.ownerClerkUserId}:${role}`,
    { company, seller, buyer, accountProfile },
    dirty && !isSaving,
  );

  useEffect(() => {
    rememberCompanyFormSnapshot(formSnapshotKey, {
      company,
      seller,
      buyer,
      accountProfile,
    });
  }, [accountProfile, buyer, company, formSnapshotKey, seller]);

  function markDirty() {
    setDirty(true);
    setSaved(false);
    setError("");
  }

  function updateCompany<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) {
    setCompany((current) => {
      const nextCompany = { ...current, [key]: value };
      rememberCompanyFormSnapshot(formSnapshotKey, {
        company: nextCompany,
        seller,
        buyer,
        accountProfile,
      });
      return nextCompany;
    });
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

  function updateAccountProfile<K extends keyof AccountProfileForSettings>(
    key: K,
    value: AccountProfileForSettings[K],
  ) {
    setAccountProfile((current) => {
      const nextProfile = { ...current, [key]: value };
      rememberCompanyFormSnapshot(formSnapshotKey, {
        company,
        seller,
        buyer,
        accountProfile: nextProfile,
      });
      return nextProfile;
    });
    markDirty();
  }

  function updateBuyer<K extends keyof BuyerCompanyProfile>(
    key: K,
    value: BuyerCompanyProfile[K],
  ) {
    setBuyer((current) => {
      const nextBuyer = { ...current, [key]: value };
      rememberCompanyFormSnapshot(formSnapshotKey, {
        company,
        seller,
        buyer: nextBuyer,
        accountProfile,
      });
      return nextBuyer;
    });
    markDirty();
  }

  function updateBuyerCategories(values: string[]) {
    const nextCompany = { ...company, categories: values };
    const nextBuyer = { ...buyer, purchasingCategories: values };
    rememberCompanyFormSnapshot(formSnapshotKey, {
      company: nextCompany,
      seller,
      buyer: nextBuyer,
      accountProfile,
    });
    setCompany(nextCompany);
    setBuyer(nextBuyer);
    markDirty();
  }

  function validate() {
    const nextErrors: CompanyFormErrors = {};
    const individualBuyer =
      role === "buyer" && isPersonalBuyerCompanyName(company.legalName);
    if (role === "seller" && !company.legalName.trim()) {
      nextErrors.legalName = t("settings.requiredField");
    }
    if (role === "buyer" && !individualBuyer && !company.legalName.trim()) {
      nextErrors.legalName = t("settings.requiredField");
    }
    if (role === "seller" && !company.country.trim()) {
      nextErrors.country = t("settings.requiredField");
    }
    if (role === "seller" && !company.city.trim()) {
      nextErrors.city = t("settings.requiredField");
    }
    if (role === "seller" && !company.businessAddress.trim()) {
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
    rememberCompanyFormSnapshot(formSnapshotKey, draft);
    setCompany(draft.company);
    setSeller(draft.seller);
    setBuyer(draft.buyer);
    setAccountProfile(draft.accountProfile ?? initialAccountProfile);
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
      let savedAccountProfile = accountProfile;
      if (role === "buyer") {
        const profileResponse = await fetch("/api/account/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: accountProfile.displayName,
            avatarOriginalUrl: accountProfile.avatarOriginalUrl,
            avatarUrl: accountProfile.avatarUrl,
            phoneNumber: accountProfile.phoneNumber,
            country: company.country || accountProfile.country || "",
            city: company.city,
            preferredLanguage: locale,
          }),
        });
        if (!profileResponse.ok) {
          setError(
            await readJsonError(profileResponse, t("settings.profileSaveError")),
          );
          return;
        }
        savedAccountProfile = buildAccountProfile(
          (await profileResponse.json()) as Record<string, unknown>,
          accountProfile,
        );
      }

      const companyForSave = {
        ...company,
        country:
          role === "seller"
            ? SOUTH_KOREA
            : company.country || accountProfile.country || "",
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
        savedAccountProfile,
      );
      rememberCompanyFormSnapshot(formSnapshotKey, savedProfile);
      setCompany(savedProfile.company);
      setSeller(savedProfile.seller);
      setBuyer(savedProfile.buyer);
      setAccountProfile(savedProfile.accountProfile);
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
    const nextCompany = {
      ...company,
      logoOriginalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl: image.mainUrl,
      useDefaultLogo: false,
      updatedAt: new Date().toISOString(),
    };
    debugCompanyLogo("company logo selected", {
      storagePath: image.storagePath,
      originalUrl: image.originalUrl,
      logoThumbnailUrl: image.cardUrl,
      logoUrl: image.mainUrl,
    });
    rememberAccountCompany(
      initialCompany.ownerClerkUserId,
      nextCompany as unknown as CompanyRecord,
    );
    rememberCompanyFormSnapshot(formSnapshotKey, {
      company: nextCompany,
      seller,
      buyer,
      accountProfile,
    });
    setCompany(nextCompany);
    setClearCompanyLogo(false);
    markDirty();
  }

  function updateBuyerAvatar(image: UploadedListingImage) {
    setAccountProfile((current) => {
      const nextProfile = {
        ...current,
        avatarOriginalUrl: image.originalUrl,
        avatarUrl: image.mainUrl || image.cardUrl || image.originalUrl,
      };
      rememberCompanyFormSnapshot(formSnapshotKey, {
        company,
        seller,
        buyer,
        accountProfile: nextProfile,
      });
      return nextProfile;
    });
    markDirty();
  }

  function removeBuyerAvatar() {
    setAccountProfile((current) => {
      const nextProfile = {
        ...current,
        avatarOriginalUrl: "",
        avatarUrl: "",
      };
      rememberCompanyFormSnapshot(formSnapshotKey, {
        company,
        seller,
        buyer,
        accountProfile: nextProfile,
      });
      return nextProfile;
    });
    markDirty();
  }

  async function handleBuyerAvatarFile(file: File) {
    const validationError = avatarValidationError(file, locale);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    handleUploadingChange(true);
    const result = await uploadAvatarFile(file, locale);
    if (result.ok) {
      updateBuyerAvatar(result.image);
    } else {
      saveQueuedAfterUploadRef.current = false;
      setSaveQueuedAfterUpload(false);
      setError(result.error);
    }
    handleUploadingChange(false);
  }

  function handleUploadingChange(uploading: boolean) {
    setIsUploading(uploading);
    if (uploading || !saveQueuedAfterUploadRef.current) return;
    saveQueuedAfterUploadRef.current = false;
    setSaveQueuedAfterUpload(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

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
  const buyerDisplayName =
    accountProfile.displayName.trim() ||
    accountProfile.email.trim() ||
    company.tradeName?.trim() ||
    (isPersonalBuyerCompanyName(company.legalName)
      ? ""
      : company.legalName.trim());
  const buyerAvatarUrl = accountProfile.avatarUrl || accountProfile.avatarOriginalUrl;
  const countryOptions = getCountryOptions(locale);

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
      {role === "seller" ? (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
            <SingleImageUploader
              kind="company_logo"
              imageUrl={companyLogoPreviewUrl}
              imageUrls={companyLogoImageUrls}
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
                  setCompany((current) => {
                    const nextCompany = {
                      ...current,
                      logoOriginalUrl: "",
                      logoThumbnailUrl: "",
                      logoUrl: "",
                      useDefaultLogo: true,
                    };
                    rememberCompanyFormSnapshot(formSnapshotKey, {
                      company: nextCompany,
                      seller,
                      buyer,
                      accountProfile,
                    });
                    return nextCompany;
                  });
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
              value={SOUTH_KOREA}
              onChange={(value) => updateCompany("country", value)}
              options={[{ value: SOUTH_KOREA, label: SOUTH_KOREA }]}
              error={fieldErrors.country}
              required
              disabled
            />
            <SelectField
              label={t("settings.cityRegion")}
              value={company.city}
              onChange={(value) => updateCompany("city", value)}
              options={getKoreanRegionOptions(locale)}
              placeholder={t("settings.selectCityRegion")}
              error={fieldErrors.city}
              required
            />
            <Field label={t("settings.businessAddress")} value={company.businessAddress} onChange={(value) => updateCompany("businessAddress", value)} error={fieldErrors.businessAddress} className="sm:col-span-2" required />
            <CheckboxGroup
              label={t("settings.categories")}
              values={company.categories}
              onChange={(values) => updateCompany("categories", values)}
              options={getSellerProductCategoryOptions(locale)}
              className="sm:col-span-2"
            />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-700">
                {t("settings.companyDescription")}
              </span>
              <textarea value={company.description} onChange={(event) => updateCompany("description", event.target.value)} rows={4} className="rounded-md border border-zinc-200 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={company.useDefaultLogo} onChange={(event) => updateCompany("useDefaultLogo", event.target.checked)} />
              {t("settings.useDefaultLogo")}
            </label>
          </section>

          <SellerFields seller={seller} setSeller={setSeller} onDirty={markDirty} />
        </>
      ) : (
        <>
          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-4">
              <ProfileAvatar
                imageUrl={buyerAvatarUrl}
                name={buyerDisplayName}
                email={accountProfile.email}
              />
              <input
                ref={buyerAvatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={isUploading || isSaving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleBuyerAvatarFile(file);
                  event.target.value = "";
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {t("settings.profileContactSection")}
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-zinc-950">
                  {buyerDisplayName || t("settings.buyerProfileSection")}
                </h3>
                <p className="truncate text-sm text-zinc-500">
                  {accountProfile.email}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => buyerAvatarInputRef.current?.click()}
                    disabled={isUploading || isSaving}
                    className="inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading
                      ? t("settings.uploadingPhoto")
                      : buyerAvatarUrl
                        ? t("settings.changePhoto")
                        : t("settings.uploadPhoto")}
                  </button>
                  {buyerAvatarUrl ? (
                    <button
                      type="button"
                      onClick={removeBuyerAvatar}
                      disabled={isUploading || isSaving}
                      className="inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t("settings.removePhoto")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("settings.buyerDisplayName")}
                value={accountProfile.displayName}
                onChange={(value) => updateAccountProfile("displayName", value)}
              />
              <Field
                label={t("onboarding.workEmail")}
                type="email"
                value={accountProfile.email}
                onChange={() => undefined}
                disabled
              />
              <Field
                label={t("settings.phoneNumber")}
                type="tel"
                value={accountProfile.phoneNumber}
                onChange={(value) => updateAccountProfile("phoneNumber", value)}
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h3 className="text-base font-semibold text-zinc-950">
                {t("settings.buyerDetailsSection")}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {t("settings.buyerProfileSectionDescription")}
              </p>
            </div>
            <SelectField
              label={t("settings.country")}
              value={company.country || accountProfile.country || ""}
              onChange={(value) => updateCompany("country", value)}
              options={countryOptions}
              placeholder={t("onboarding.select")}
              error={fieldErrors.country}
            />
            <Field label={t("settings.city")} value={company.city} onChange={(value) => updateCompany("city", value)} error={fieldErrors.city} />
            {(company.country || accountProfile.country) === UNITED_STATES ? (
              <SelectField
                label={t("settings.state")}
                value={company.stateOrProvince}
                onChange={(value) => updateCompany("stateOrProvince", value)}
                options={getUsStateOptions(locale)}
                placeholder={t("settings.selectState")}
                error={fieldErrors.stateOrProvince}
              />
            ) : (
              <Field
                label={t("settings.stateProvince")}
                value={company.stateOrProvince}
                onChange={(value) => updateCompany("stateOrProvince", value)}
              />
            )}
            <SelectField
              label={t("settings.buyerType")}
              value={buyer.buyerType}
              onChange={(value) =>
                updateBuyer("buyerType", value as BuyerCompanyProfile["buyerType"])
              }
              options={getBuyerTypeOptions(locale)}
            />
            <CheckboxGroup
              label={t("settings.purchasingCategories")}
              values={buyer.purchasingCategories}
              onChange={updateBuyerCategories}
              options={getBuyerCategoryOptions(locale)}
              className="sm:col-span-2"
            />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-700">
                {t("settings.marketStrategy")}
              </span>
              <textarea value={company.description} onChange={(event) => updateCompany("description", event.target.value)} rows={4} className="rounded-md border border-zinc-200 px-3 py-2" />
            </label>
          </section>
        </>
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
              : role === "buyer"
                ? t("common.save")
                : t("settings.saveCompany")}
        </button>
        {saved ? <span className="text-sm text-emerald-700">{t("settings.saved")}</span> : null}
      </div>
      {isUploading ? (
        <p className="text-sm text-amber-700" aria-live="polite">
          {saveQueuedAfterUpload
            ? role === "buyer"
              ? t("settings.profilePhotoUploadSaveQueued")
              : t("settings.logoUploadSaveQueued")
            : role === "buyer"
              ? t("settings.profilePhotoUploadInProgress")
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

function ProfileAvatar({
  imageUrl,
  name,
  email,
}: {
  imageUrl: string;
  name: string;
  email: string;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    email.slice(0, 2).toUpperCase() ||
    "B";

  if (imageUrl && failedUrl !== imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="size-14 rounded-full border border-zinc-200 object-cover"
        onError={() => setFailedUrl(imageUrl)}
      />
    );
  }

  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-600">
      {initials}
    </div>
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "email" | "tel";
  className?: string;
  fieldName?: string;
  preventAutofill?: boolean;
  error?: string;
  required?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        autoComplete={preventAutofill ? "new-password" : "off"}
        data-1p-ignore={preventAutofill ? "true" : undefined}
        data-lpignore={preventAutofill ? "true" : undefined}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 px-3 aria-invalid:border-red-300 disabled:bg-zinc-50 disabled:text-zinc-500"
      />
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
