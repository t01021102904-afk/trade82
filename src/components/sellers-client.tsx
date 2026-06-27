"use client";

import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { SellerCard } from "@/components/seller-card";
import { marketplaceCategories } from "@/lib/marketplace";
import { databaseCompanyToSeller } from "@/lib/public-marketplace-presenters";
import type { Seller } from "@/lib/types";

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

export function SellersClient() {
  const { t } = useI18n();
  const [databaseSellers, setDatabaseSellers] = useState<Seller[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  useEffect(() => {
    void fetch("/api/public/marketplace")
      .then((response) => (response.ok ? response.json() : { companies: [] }))
      .then((result: { companies?: Array<Record<string, unknown>> }) => {
        setDatabaseSellers(
          (result.companies ?? [])
            .filter((company) => company.companyRole === "seller")
            .map(databaseCompanyToSeller),
        );
        setDatabaseLoading(false);
      })
      .catch(() => {
        setDatabaseSellers([]);
        setDatabaseLoading(false);
      });
  }, []);
  const visibleSellers = databaseSellers;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");
  const [verified, setVerified] = useState("all");
  const [exportExperience, setExportExperience] = useState("all");

  const states = useMemo(
    () => Array.from(new Set(visibleSellers.map((seller) => seller.state))).sort(),
    [visibleSellers],
  );

  const filtered = useMemo(() => {
    return visibleSellers.filter((seller) => {
      const haystack = [
        seller.name,
        seller.location,
        seller.businessType,
        seller.description,
        seller.certifications.join(" "),
        seller.categories.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesCategory =
        category === "all" || seller.categories.includes(category as never);
      const matchesState = state === "all" || seller.state === state;
      const matchesVerified =
        verified === "all" ||
        (verified === "verified" && seller.verified) ||
        (verified === "reviewing" && !seller.verified);
      const matchesExport =
        exportExperience === "all" ||
        (exportExperience === "korea" && seller.exportCountries.includes("United States")) ||
        (exportExperience === "multi" && seller.exportCountries.length >= 3) ||
        (exportExperience === "fast" && seller.responseTime.toLowerCase().includes("under"));

      return (
        matchesSearch &&
        matchesCategory &&
        matchesState &&
        matchesVerified &&
        matchesExport
      );
    });
  }, [visibleSellers, search, category, state, verified, exportExperience]);

  return (
    <div className="grid gap-8">
      <div className="bm-premium-card rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-sm shadow-zinc-100 backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">{t("sellers.search")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("sellers.searchPlaceholder")}
              className="h-10 rounded-md border border-zinc-200 px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <SelectField
            label={t("marketplace.category")}
            value={category}
            onChange={setCategory}
            options={[
              { label: t("marketplace.allCategories"), value: "all" },
              ...marketplaceCategories.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("sellers.state")}
            value={state}
            onChange={setState}
            options={[
              { label: t("sellers.allStates"), value: "all" },
              ...states.map((item) => ({ label: item, value: item })),
            ]}
          />
          <SelectField
            label={t("sellers.verified")}
            value={verified}
            onChange={setVerified}
            options={[
              { label: t("sellers.anyStatus"), value: "all" },
              { label: t("sellers.verifiedOnly"), value: "verified" },
              { label: t("sellers.inReview"), value: "reviewing" },
            ]}
          />
          <SelectField
            label={t("sellers.exportExperience")}
            value={exportExperience}
            onChange={setExportExperience}
            options={[
              { label: t("sellers.anyExperience"), value: "all" },
              { label: t("sellers.exportsToKorea"), value: "korea" },
              { label: t("sellers.markets3"), value: "multi" },
              { label: t("common.fastResponse"), value: "fast" },
            ]}
          />
        </div>
        <div className="relative z-10 mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <span>{filtered.length} {t("sellers.sellerFound")}</span>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("all");
              setState("all");
              setVerified("all");
              setExportExperience("all");
            }}
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      {databaseLoading && !visibleSellers.length ? (
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
          {filtered.map((seller) => (
            <SellerCard key={seller.id} seller={seller} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm shadow-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-950">
            {visibleSellers.length
              ? t("sellers.emptyTitle")
              : t("sellers.noCompaniesListed")}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {visibleSellers.length
              ? t("sellers.emptyText")
              : t("sellers.noCompaniesListedText")}
          </p>
        </div>
      )}
    </div>
  );
}
