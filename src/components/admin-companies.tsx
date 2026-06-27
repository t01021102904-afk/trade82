"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type AdminCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  companyRole: "seller" | "buyer";
  verificationStatus: string;
  country: string;
  city: string;
  createdAt: string;
  ownerEmail: string;
  ownerDisplayName: string;
  productCount: number;
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
  const [allCompanies, setAllCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<Record<string, { pending: boolean; message: string; error: string }>>({});
  const [docError, setDocError] = useState("");

  const companies = roleFilter
    ? allCompanies.filter((c) => c.companyRole === roleFilter)
    : allCompanies;

  useEffect(() => {
    void fetch("/api/admin/companies")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AdminCompany[] | null) => {
        if (data) setAllCompanies(data);
        else setError(admin.unableLoadCompanies);
        setLoading(false);
      });
  }, [admin.unableLoadCompanies]);

  async function performAction(companyId: string, action: string) {
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
    <div className="grid gap-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : null}
      {docError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{docError}</p>
      ) : null}

      <p className="text-sm text-zinc-500">
        {countText}
        {roleFilter ? (
          <a href={withLocale("/admin/companies", locale)} className="ml-2 text-blue-700 hover:underline">
            {admin.showAll}
          </a>
        ) : null}
      </p>

      {companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
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
            className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 lg:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-zinc-950">
                  {company.tradeName || company.legalName}
                </h3>
                {company.tradeName ? (
                  <span className="text-sm text-zinc-500">({company.legalName})</span>
                ) : null}
                <Badge tone={tone}>{label}</Badge>
                <Badge tone={company.companyRole === "seller" ? "blue" : "amber"}>
                  {roleLabel(company.companyRole)}
                </Badge>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-zinc-500">{admin.owner}</dt>
                  <dd className="truncate font-mono text-xs">{company.ownerEmail}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">{admin.location}</dt>
                  <dd>{[company.city, company.country].filter(Boolean).join(", ") || "—"}</dd>
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

              {state?.message ? (
                <p className="mt-3 text-sm font-medium text-emerald-700">{state.message}</p>
              ) : null}
              {state?.error ? (
                <p className="mt-3 text-sm font-medium text-red-700">{state.error}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
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
                className="rounded-md border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
              >
                {admin.viewProfile}
              </a>

              {company.verificationStatus !== "verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "approve")}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.publishListing}
                </button>
              ) : null}

              {company.verificationStatus === "verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "pause")}
                  className="rounded-md border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 disabled:cursor-wait disabled:opacity-60"
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
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.requestUpdates}
                </button>
              ) : null}

              {company.verificationStatus !== "rejected" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "reject")}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.rejectListing}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void performAction(company.id, "reset")}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.reopenReview}
                </button>
              )}
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
    rejected: { label: admin.statusNeedsUpdates, tone: "gray" },
    unverified: { label: admin.statusPending, tone: "gray" },
  };

  return labels[status] ?? { label: status, tone: "gray" as const };
}

function formatDateUtc(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return locale === "ko" ? `${year}.${month}.${day}` : `${month}/${day}/${year}`;
}
