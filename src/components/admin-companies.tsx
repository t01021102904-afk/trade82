"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AdminBadge } from "@/components/admin-badge";
import { AdminCompanyLogo } from "@/components/admin-company-logo";
import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type StatusFilter = "pending" | "updates" | "listed" | "paused" | "rejected" | "all";

type AdminProduct = {
  id: string;
  name: string;
  status: string;
  category: string;
  imageUrl: string | null;
  updatedAt: string;
};

type AdminCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  companyRole: "seller" | "buyer";
  verificationStatus: string;
  logoOriginalUrl: string | null;
  logoThumbnailUrl: string | null;
  logoUrl: string | null;
  useDefaultLogo: boolean;
  country: string;
  city: string;
  stateOrProvince: string;
  createdAt: string;
  ownerEmail: string;
  ownerDisplayName: string;
  isTrade82Team: boolean;
  productCount: number;
  products: AdminProduct[];
  inquiryCount: number;
  latestRequest: {
    id: string;
    status: string;
    documentFilename: string | null;
    createdAt: string;
  } | null;
};

export function AdminCompanies() {
  const { locale, messages } = useI18n();
  const admin = messages.admin;
  const searchParams = useSearchParams();
  const roleFilter = searchParams.get("role") as "seller" | "buyer" | null;
  const statusParam = parseStatusFilter(searchParams.get("status"));
  const [allCompanies, setAllCompanies] = useState<AdminCompany[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => statusParam ?? "pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<Record<string, { pending: boolean; message: string; error: string }>>({});
  const [docError, setDocError] = useState("");

  const loadCompanies = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    const response = await fetch("/api/admin/companies", { cache: "no-store" });
    if (!response.ok) {
      setError(admin.unableLoadCompanies);
      setLoading(false);
      return;
    }
    const data = (await response.json()) as AdminCompany[];
    setAllCompanies(data);
    setLoading(false);
  }, [admin.unableLoadCompanies]);

  const companies = useMemo(
    () =>
      allCompanies
        .filter((company) => !roleFilter || company.companyRole === roleFilter)
        .filter((company) => statusMatchesFilter(company.verificationStatus, statusFilter))
        .filter((company) => companyMatchesSearch(company, search, admin)),
    [admin, allCompanies, roleFilter, search, statusFilter],
  );

  useEffect(() => {
    let active = true;

    void fetch("/api/admin/companies", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AdminCompany[] | null) => {
        if (!active) return;
        if (data) setAllCompanies(data);
        else setError(admin.unableLoadCompanies);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(admin.unableLoadCompanies);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin.unableLoadCompanies]);

  async function performAction(companyId: string, action: string) {
    if (
      action === "reject" &&
      !window.confirm(admin.confirmRejectListing)
    ) {
      return;
    }
    setActionState((prev) => ({
      ...prev,
      [companyId]: { pending: true, message: "", error: "" },
    }));
    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; verificationStatus?: string; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setActionState((prev) => ({
          ...prev,
          [companyId]: { pending: false, message: "", error: result?.error ?? admin.actionFailed },
        }));
        return;
      }

      setAllCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? { ...c, verificationStatus: result.verificationStatus ?? c.verificationStatus }
            : c,
        ),
      );
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: admin.actionDone, error: "" },
      }));
      setTimeout(() => {
        setActionState((prev) => ({ ...prev, [companyId]: { pending: false, message: "", error: "" } }));
      }, 3000);
      void loadCompanies({ silent: true });
    } catch {
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: "", error: admin.networkError },
      }));
    }
  }

  async function deleteProduct(companyId: string, productId: string) {
    if (!window.confirm(admin.confirmDeleteProductPermanent)) return;

    setActionState((prev) => ({
      ...prev,
      [companyId]: { pending: true, message: "", error: "" },
    }));
    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, productId, action: "delete_product" }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; productId?: string; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setActionState((prev) => ({
          ...prev,
          [companyId]: { pending: false, message: "", error: result?.error ?? admin.productDeleteFailed },
        }));
        return;
      }

      setAllCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId
            ? {
                ...company,
                products: company.products.filter((product) => product.id !== productId),
                productCount: Math.max(0, company.productCount - 1),
              }
            : company,
        ),
      );
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: admin.productDeleted, error: "" },
      }));
      setTimeout(() => {
        setActionState((prev) => ({ ...prev, [companyId]: { pending: false, message: "", error: "" } }));
      }, 3000);
      void loadCompanies({ silent: true });
    } catch {
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: "", error: admin.networkError },
      }));
    }
  }

  async function deleteCompany(companyId: string) {
    if (!window.confirm(admin.confirmDeleteCompanyPermanent)) return;

    setActionState((prev) => ({
      ...prev,
      [companyId]: { pending: true, message: "", error: "" },
    }));
    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action: "delete_company" }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; companyId?: string; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setActionState((prev) => ({
          ...prev,
          [companyId]: { pending: false, message: "", error: result?.error ?? admin.companyDeleteFailed },
        }));
        return;
      }

      setAllCompanies((prev) => prev.filter((company) => company.id !== companyId));
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: admin.companyDeleted, error: "" },
      }));
    } catch {
      setActionState((prev) => ({
        ...prev,
        [companyId]: { pending: false, message: "", error: admin.networkError },
      }));
    }
  }

  async function openDocument(requestId: string) {
    setDocError("");
    const response = await fetch(`/api/storage/verification-documents/${requestId}`);
    const result = (await response.json().catch(() => null)) as
      | { signedUrl?: string; error?: string }
      | null;
    if (!response.ok || !result?.signedUrl) {
      setDocError(result?.error ?? admin.documentOpenFailed);
      return;
    }
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">{admin.loadingCompanies}</p>;
  }

  const roleLabel = (role: "seller" | "buyer") =>
    role === "seller" ? admin.roleSeller : admin.roleBuyer;
  const countText =
    locale === "ko"
      ? `${roleFilter ? `${roleLabel(roleFilter)} ` : ""}${companies.length}${admin.companyCount}`
      : `${companies.length} ${roleFilter ? `${roleLabel(roleFilter)} ` : ""}${admin.companyCount}`;

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      {docError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{docError}</p>
      ) : null}

      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3">
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          {admin.searchCompanies}
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={admin.searchCompaniesPlaceholder}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-normal text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {statusFilterOptions(admin).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={`h-8 rounded-md border px-2.5 text-xs font-medium transition ${
                statusFilter === option.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        {countText}
        {roleFilter ? (
          <a href={withLocale("/admin/companies", locale)} className="ml-2 text-blue-700 hover:underline">
            {admin.showAll}
          </a>
        ) : null}
      </p>

      {companies.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white p-5 text-center">
          <p className="text-sm text-zinc-600">{admin.noCompaniesTitle}</p>
          <p className="mt-2 text-xs text-zinc-500">
            {admin.noCompaniesText}
          </p>
        </div>
      ) : null}

      {companies.map((company) => {
        const state = actionState[company.id];
        const { label, tone } = statusLabel(company.verificationStatus, admin);
        const isPending = state?.pending ?? false;

        return (
          <article
            key={company.id}
            className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
              <AdminCompanyLogo
                companyName={company.tradeName || company.legalName}
                logoUrl={company.useDefaultLogo ? "" : company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">
                    {company.tradeName || company.legalName}
                  </h3>
                  {company.isTrade82Team ? <AdminBadge /> : null}
                  {company.tradeName ? (
                    <span className="text-sm text-zinc-500">({company.legalName})</span>
                  ) : null}
                  <Badge tone={tone}>{label}</Badge>
                  <Badge tone={company.companyRole === "seller" ? "blue" : "amber"}>
                    {roleLabel(company.companyRole)}
                  </Badge>
                </div>

                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">{admin.owner}</dt>
                    <dd className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-mono text-xs">{company.ownerEmail}</span>
                      {company.isTrade82Team ? <AdminBadge compact /> : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{admin.location}</dt>
                    <dd>{[company.city, company.stateOrProvince, company.country].filter(Boolean).join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{admin.created}</dt>
                    <dd>{formatDateUtc(company.createdAt, locale)}</dd>
                  </div>
                  {company.companyRole === "seller" ? (
                    <div>
                      <dt className="text-zinc-500">{admin.products}</dt>
                      <dd>{company.productCount}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-zinc-500">{admin.inquiries}</dt>
                    <dd>{company.inquiryCount}</dd>
                  </div>
                  {company.latestRequest ? (
                    <div>
                      <dt className="text-zinc-500">{admin.submittedDocument}</dt>
                      <dd>
                        {company.latestRequest.documentFilename ? (
                          <button
                            type="button"
                            onClick={() => void openDocument(company.latestRequest!.id)}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {admin.openDocument}
                          </button>
                        ) : (
                          admin.noDocument
                        )}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {company.products.length ? (
                  <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{admin.products}</p>
                    <div className="mt-2 grid gap-1.5">
                      {company.products.map((product) => (
                        <div
                          key={product.id}
                          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-white p-2"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <AdminCompanyLogo
                              companyName={product.name}
                              logoUrl={product.imageUrl}
                              className="size-12 rounded-md"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900">{product.name}</p>
                              <p className="truncate text-xs text-zinc-500">{product.category} · {product.status}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => void deleteProduct(company.id, product.id)}
                            className="h-8 rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 hover:border-red-300 disabled:cursor-wait disabled:opacity-60"
                          >
                            {isPending ? admin.saving : admin.deletePermanently}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {state?.message ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">{state.message}</p>
                ) : null}
                {state?.error ? (
                  <p className="mt-3 text-sm font-medium text-red-700">{state.error}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 lg:w-36 lg:flex-col">
              <a
                href={
                  withLocale(
                    company.companyRole === "seller"
                      ? `/companies/${company.id}`
                      : `/buyers/${company.id}`,
                    locale,
                  )
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 px-2.5 text-center text-xs font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
              >
                {admin.viewProfile}
              </a>

              {company.verificationStatus !== "verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "approve")}
                  className="h-8 rounded-md bg-zinc-950 px-2.5 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.publishListing}
                </button>
              ) : null}

              {company.verificationStatus === "verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "pause")}
                  className="h-8 rounded-md border border-amber-200 px-2.5 text-xs font-medium text-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.pauseListing}
                </button>
              ) : null}

              {company.verificationStatus === "needs_reverification" ||
              company.verificationStatus === "pending_review" ||
              company.verificationStatus === "email_verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "request_updates")}
                  className="h-8 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.requestUpdates}
                </button>
              ) : null}

              {company.verificationStatus !== "rejected" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "reject")}
                  className="h-8 rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.rejectListing}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "reset")}
                  className="h-8 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.reopenReview}
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => void deleteCompany(company.id)}
                className="h-8 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isPending ? admin.saving : admin.deletePermanently}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function statusLabel(
  status: string,
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  const labels: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }> = {
    verified: { label: admin.statusPublic, tone: "green" },
    pending_review: { label: admin.statusPending, tone: "amber" },
    email_verified: { label: admin.statusPending, tone: "amber" },
    needs_reverification: { label: admin.statusPaused, tone: "red" },
    rejected: { label: admin.statusRejected, tone: "gray" },
    unverified: { label: admin.statusPending, tone: "gray" },
  };

  return labels[status] ?? { label: status, tone: "gray" as const };
}

function parseStatusFilter(value: string | null): StatusFilter | null {
  if (
    value === "pending" ||
    value === "updates" ||
    value === "listed" ||
    value === "paused" ||
    value === "rejected" ||
    value === "all"
  ) {
    return value;
  }
  return null;
}

function statusFilterOptions(
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
): Array<{ id: StatusFilter; label: string }> {
  return [
    { id: "all", label: admin.filterAll },
    { id: "pending", label: admin.filterPending },
    { id: "updates", label: admin.filterUpdates },
    { id: "listed", label: admin.filterListed },
    { id: "paused", label: admin.filterPaused },
    { id: "rejected", label: admin.filterRejected },
  ];
}

function statusMatchesFilter(status: string, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "listed") return status === "verified";
  if (filter === "paused" || filter === "updates") return status === "needs_reverification";
  if (filter === "rejected") return status === "rejected";
  return status === "pending_review" || status === "email_verified" || status === "unverified";
}

function companyMatchesSearch(
  company: AdminCompany,
  search: string,
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  const { label } = statusLabel(company.verificationStatus, admin);
  const role = company.companyRole === "seller" ? admin.roleSeller : admin.roleBuyer;
  const haystack = [
    company.legalName,
    company.tradeName ?? "",
    company.ownerEmail,
    company.ownerDisplayName,
    company.city,
    company.stateOrProvince,
    company.country,
    company.companyRole,
    role,
    company.verificationStatus,
    label,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function formatDateUtc(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return locale === "ko" ? `${year}.${month}.${day}` : `${month}/${day}/${year}`;
}
