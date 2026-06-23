"use client";

import { useEffect, useMemo, useState } from "react";

import { BuyerCard } from "@/components/buyer-card";
import { useI18n } from "@/components/i18n-provider";
import { categories } from "@/lib/mock-data";
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

export function BuyersClient({ buyers }: { buyers: Buyer[] }) {
  const { t } = useI18n();
  const [databaseBuyers, setDatabaseBuyers] = useState<Buyer[]>([]);
  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) => (response.ok ? response.json() : { companies: [] }))
      .then((result: { companies?: Array<Record<string, unknown>> }) => {
        setDatabaseBuyers(
          (result.companies ?? [])
            .filter((company) => company.companyRole === "buyer")
            .map(databaseCompanyToBuyer),
        );
      });
  }, []);
  const visibleBuyers = useMemo(() => {
    return [
      ...databaseBuyers,
      ...buyers.filter(
        (buyer) =>
          !databaseBuyers.some((existing) => existing.id === buyer.id),
      ),
    ];
  }, [buyers, databaseBuyers]);
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
        category === "all" || buyer.interestedCategories.includes(category as never);
      const matchesOrderSize =
        orderSize === "all" ||
        (orderSize === "trial" && buyer.targetOrderSize.includes("trial")) ||
        (orderSize === "mid" &&
          !buyer.targetOrderSize.includes("trial") &&
          !buyer.targetOrderSize.includes("150,000")) ||
        (orderSize === "large" &&
          (buyer.targetOrderSize.includes("100,000") ||
            buyer.targetOrderSize.includes("150,000")));
      const matchesExperience =
        importExperience === "all" ||
        (importExperience === "early" && years <= 4) ||
        (importExperience === "experienced" && years >= 5) ||
        (importExperience === "advanced" && years >= 10);

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
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
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
              ...categories.map((item) => ({ label: item, value: item })),
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
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm text-zinc-600">
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

      {filtered.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((buyer) => (
            <BuyerCard key={buyer.id} buyer={buyer} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-950">{t("buyers.emptyTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t("buyers.emptyText")}
          </p>
        </div>
      )}
    </div>
  );
}

function databaseCompanyToBuyer(company: Record<string, unknown>): Buyer {
  const profile = (company.buyerProfile ?? {}) as Record<string, unknown>;
  const type = String(profile.buyerType ?? "importer");
  const buyerType =
    type === "distributor"
      ? "Distributor"
      : type === "retailer"
        ? "Retailer"
        : type === "online_seller"
          ? "Online Seller"
          : "Importer";
  return {
    id: String(company.id),
    name: String(company.tradeName ?? company.legalName ?? ""),
    logoUrl: typeof company.logoUrl === "string" ? company.logoUrl : undefined,
    useDefaultLogo: company.useDefaultLogo !== false,
    location: [company.city, company.country].filter(Boolean).join(", "),
    buyerType,
    interestedCategories:
      (profile.purchasingCategories as Buyer["interestedCategories"]) ?? [],
    targetOrderSize: String(profile.targetOrderSize ?? ""),
    annualImportVolume: String(profile.monthlyImportVolume ?? ""),
    salesChannels: (profile.salesChannels as string[]) ?? [],
    importExperience: String(profile.importExperience ?? ""),
    requiredDocuments: [],
    preferredPaymentTerms: [],
    timeline: String(profile.purchaseTimeline ?? ""),
    marketStrategy: String(company.description ?? ""),
    contactPerson: "Purchasing team",
    contactEmail: "",
    verified: true,
    verificationStatus: "verified",
  };
}
