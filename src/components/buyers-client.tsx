"use client";

import { useEffect, useMemo, useState } from "react";

import { BuyerCard } from "@/components/buyer-card";
import { useI18n } from "@/components/i18n-provider";
import {
  buyerCategoryLabel,
  buyerTypeLabel,
  countryLabel,
  getBuyerCategoryOptions,
  importExperienceLabel,
  importVolumeLabel,
  koreanRegionLabel,
  optionLabels,
  orderSizeLabel,
  salesChannelLabel,
  sourcingTimelineLabel,
  stateLabel,
  SOUTH_KOREA,
  UNITED_STATES,
} from "@/lib/company-select-options";
import type { Buyer } from "@/lib/types";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function firstYearCount(text: string) {
  return Number(text.match(/\d+/)?.[0] ?? 0);
}

export function BuyersClient() {
  const { locale, t } = useI18n();
  const [databaseBuyers, setDatabaseBuyers] = useState<Buyer[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const notProvided = t("common.notProvided");
  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) => (response.ok ? response.json() : { companies: [] }))
      .then((result: { companies?: Array<Record<string, unknown>> }) => {
        setDatabaseBuyers(
          (result.companies ?? [])
            .filter((company) => company.companyRole === "buyer")
            .map((company) => databaseCompanyToBuyer(company, notProvided, locale)),
        );
        setDatabaseLoading(false);
      })
      .catch(() => {
        setDatabaseBuyers([]);
        setDatabaseLoading(false);
      });
  }, [locale, notProvided]);
  const visibleBuyers = databaseBuyers;
  const [search, setSearch] = useState("");
  const [buyerType, setBuyerType] = useState("all");
  const [category, setCategory] = useState("all");
  const [orderSize, setOrderSize] = useState("all");
  const [importExperience, setImportExperience] = useState("all");

  const buyerTypes = useMemo(
    () => Array.from(new Set(visibleBuyers.map((buyer) => buyer.buyerType))).sort(),
    [visibleBuyers],
  );

  const filtered = useMemo(() => {
    return visibleBuyers.filter((buyer) => {
      const haystack = [
        buyer.name,
        buyer.location,
        buyer.buyerType,
        buyer.interestedCategories.join(" "),
        buyer.salesChannels.join(" "),
        buyer.marketStrategy,
      ]
        .join(" ")
        .toLowerCase();
      const years = firstYearCount(buyer.importExperience);
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesType = buyerType === "all" || buyer.buyerType === buyerType;
      const matchesCategory =
        category === "all" || buyer.interestedCategoryCodes?.includes(category);
      const matchesOrderSize =
        orderSize === "all" ||
        (orderSize === "trial" && buyer.targetOrderSizeCode === "sample_only") ||
        (orderSize === "mid" &&
          [
            "under_1000",
            "1000_5000",
            "5000_10000",
            "10000_50000",
            "not_sure_yet",
          ].includes(buyer.targetOrderSizeCode ?? "")) ||
        (orderSize === "large" && buyer.targetOrderSizeCode === "50000_plus");
      const matchesExperience =
        importExperience === "all" ||
        (importExperience === "early" &&
          ["first_time", "need_guidance"].includes(buyer.importExperienceCode ?? "")) ||
        (importExperience === "experienced" &&
          ["some_experience", "working_with_overseas_suppliers"].includes(
            buyer.importExperienceCode ?? "",
          )) ||
        (importExperience === "advanced" && buyer.importExperienceCode === "experienced") ||
        (!buyer.importExperienceCode &&
          ((importExperience === "early" && years <= 4) ||
            (importExperience === "experienced" && years >= 5) ||
            (importExperience === "advanced" && years >= 10)));

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesOrderSize &&
        matchesExperience
      );
    });
  }, [visibleBuyers, search, buyerType, category, orderSize, importExperience]);

  return (
    <div className="grid gap-8">
      <div className="bm-premium-card rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-sm shadow-zinc-100 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">{t("buyers.search")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("buyers.searchPlaceholder")}
              className="h-10 rounded-md border border-zinc-200 px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <SelectField
            label={t("buyers.buyerType")}
            value={buyerType}
            onChange={setBuyerType}
            options={[
              { label: t("buyers.allBuyerTypes"), value: "all" },
              ...buyerTypes.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("marketplace.category")}
            value={category}
            onChange={setCategory}
            options={[
              { label: t("marketplace.allCategories"), value: "all" },
              ...getBuyerCategoryOptions(locale),
            ]}
          />
          <SelectField
            label={t("buyers.orderSize")}
            value={orderSize}
            onChange={setOrderSize}
            options={[
              { label: t("buyers.anySize"), value: "all" },
              { label: t("buyers.trialOrders"), value: "trial" },
              { label: t("buyers.midMarket"), value: "mid" },
              { label: t("buyers.largePrograms"), value: "large" },
            ]}
          />
          <SelectField
            label={t("buyers.importExperience")}
            value={importExperience}
            onChange={setImportExperience}
            options={[
              { label: t("sellers.anyExperience"), value: "all" },
              { label: t("buyers.upTo4"), value: "early" },
              { label: t("buyers.years5"), value: "experienced" },
              { label: t("buyers.years10"), value: "advanced" },
            ]}
          />
        </div>
        <div className="relative z-10 mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <span>{filtered.length} {t("buyers.buyersFound")}</span>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setBuyerType("all");
              setCategory("all");
              setOrderSize("all");
              setImportExperience("all");
            }}
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      {databaseLoading && !visibleBuyers.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-100"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((buyer) => (
            <BuyerCard key={buyer.id} buyer={buyer} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm shadow-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-950">
            {visibleBuyers.length
              ? t("buyers.emptyTitle")
              : t("buyers.noBuyerProfilesListed")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {visibleBuyers.length
              ? t("buyers.emptyText")
              : t("buyers.noBuyerProfilesListedText")}
          </p>
        </div>
      )}
    </div>
  );
}

function databaseCompanyToBuyer(
  company: Record<string, unknown>,
  fallback: string,
  locale: "en" | "ko",
): Buyer {
  const profile = (company.buyerProfile ?? {}) as Record<string, unknown>;
  const owner = (company.owner ?? {}) as Record<string, unknown>;
  const type = String(profile.buyerType ?? "importer");
  const purchasingCategoryCodes = cleanBuyerList(profile.purchasingCategories);
  const salesChannelCodes = cleanBuyerList(profile.salesChannels);
  const targetOrderSizeCode = cleanBuyerText(profile.targetOrderSize, "", 80);
  const importVolumeCode = cleanBuyerText(profile.monthlyImportVolume, "", 80);
  const importExperienceCode = cleanBuyerText(profile.importExperience, "", 160);
  const timelineCode = cleanBuyerText(profile.purchaseTimeline, "", 80);
  const targetOrderSize =
    orderSizeLabel(targetOrderSizeCode, locale) ||
    cleanBuyerMetric(profile.targetOrderSize, company, fallback);
  const annualImportVolume =
    importVolumeLabel(importVolumeCode, locale) ||
    cleanBuyerMetric(profile.monthlyImportVolume, company, fallback);
  const importExperience =
    importExperienceLabel(importExperienceCode, locale) ||
    cleanBuyerText(profile.importExperience, fallback, 160);
  const timeline =
    sourcingTimelineLabel(timelineCode, locale) ||
    cleanBuyerText(profile.purchaseTimeline, fallback, 80);

  return {
    id: String(company.id),
    name: cleanBuyerText(company.tradeName ?? company.legalName, fallback, 90),
    logoUrl:
      typeof company.logoThumbnailUrl === "string"
        ? company.logoThumbnailUrl
        : typeof company.logoUrl === "string"
          ? company.logoUrl
          : undefined,
    useDefaultLogo: company.useDefaultLogo !== false,
    location: formatCompanyLocation(company, locale) || fallback,
    buyerType: buyerTypeLabel(type, locale),
    buyerTypeCode: type,
    interestedCategories: optionLabels(
      purchasingCategoryCodes,
      buyerCategoryLabel,
      locale,
    ),
    interestedCategoryCodes: purchasingCategoryCodes,
    targetOrderSize,
    targetOrderSizeCode,
    annualImportVolume,
    salesChannels: optionLabels(salesChannelCodes, salesChannelLabel, locale),
    salesChannelCodes,
    importExperience,
    importExperienceCode,
    requiredDocuments: [],
    preferredPaymentTerms: [],
    timeline,
    timelineCode,
    marketStrategy: cleanBuyerText(company.description, fallback, 240),
    contactPerson: cleanBuyerText(owner.displayName, "", 90),
    contactEmail: "",
    verified: true,
    verificationStatus: "verified",
    isTrade82Team: company.isTrade82Team === true,
  };
}

function formatCompanyLocation(company: Record<string, unknown>, locale: "en" | "ko") {
  const country = typeof company.country === "string" ? company.country : "";
  const city = typeof company.city === "string" ? company.city : "";
  const state = typeof company.stateOrProvince === "string" ? company.stateOrProvince : "";
  const cityLabel = country === SOUTH_KOREA ? koreanRegionLabel(city, locale) : city;
  const stateText = country === UNITED_STATES ? stateLabel(state, locale) : state;

  return cleanLocation([cityLabel, stateText, countryLabel(country, locale)]);
}

function cleanBuyerMetric(
  value: unknown,
  company: Record<string, unknown>,
  fallback: string,
) {
  const text = cleanBuyerText(value, fallback, 80);
  if (text === fallback || isLocationOrAddress(text, company)) {
    return fallback;
  }

  return text;
}

function cleanBuyerText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const text = String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!text || isUrlLike(text)) {
    return fallback;
  }

  return text;
}

function cleanBuyerList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item && !isUrlLike(item))
    .slice(0, 8);
}

function cleanLocation(parts: unknown[]) {
  return parts
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item && !isUrlLike(item))
    .join(", ");
}

function isUrlLike(value: string) {
  const normalized = value.toLowerCase();
  return (
    /^https?:\/\//.test(normalized) ||
    normalized.includes("localhost") ||
    normalized.startsWith("/onboarding") ||
    normalized.startsWith("onboarding/") ||
    normalized.startsWith("/login") ||
    normalized.startsWith("/signup")
  );
}

function isLocationOrAddress(
  value: string,
  company: Record<string, unknown>,
) {
  const normalized = value.toLowerCase();
  const locationParts = [
    company.businessAddress,
    company.city,
    company.stateOrProvince,
    company.country,
  ]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((item) => item.length > 3);

  return locationParts.some(
    (part) =>
      normalized === part ||
      normalized.includes(part) ||
      (normalized.length > 6 && part.includes(normalized)),
  );
}
