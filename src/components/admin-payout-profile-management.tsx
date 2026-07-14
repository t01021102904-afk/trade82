"use client";

import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { formatTradeDate, payoutProfileStatusLabel } from "@/lib/trade-order-i18n";

type Profile = {
  id: string;
  companyId: string;
  country: string;
  bankName: string;
  accountHolder: string;
  accountNumberMasked: string | null;
  status: string;
  updatedAt: string;
  company: { legalName: string; tradeName: string | null };
};

export function AdminPayoutProfileManagement() {
  const { locale, t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/payout-profiles", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.loadError"));
      setProfiles(data.profiles ?? []);
    } catch {
      setError(t("payouts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(id: string, actionName: "verify" | "reject") {
    setError("");
    try {
      const response = await fetch(`/api/admin/payout-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName }),
      });
      await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("payouts.updatePayoutError"));
      await load();
    } catch {
      setError(t("payouts.updatePayoutError"));
    }
  }

  const headers = [
    t("payouts.profile.seller"),
    t("payouts.profile.country"),
    t("payouts.profile.bank"),
    t("payouts.profile.accountHolder"),
    t("payouts.profile.maskedAccount"),
    t("payouts.profile.status"),
    t("payouts.profile.updated"),
    "",
  ];

  return (
    <section className="grid gap-4">
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <Loader2 className="size-5 animate-spin" aria-label={t("payouts.loading")} /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-[800px] text-left text-sm">
            <thead className="border-b theme-surface-muted"><tr>{headers.map((label, index) => <th key={`${label}-${index}`} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>
              {profiles.length ? profiles.map((profile) => (
                <tr key={profile.id} className="border-b theme-border">
                  <td className="px-3 py-3 font-medium">{profile.company.tradeName || profile.company.legalName}</td>
                  <td className="px-3 py-3">{profile.country}</td>
                  <td className="px-3 py-3">{profile.bankName}</td>
                  <td className="px-3 py-3">{profile.accountHolder}</td>
                  <td className="px-3 py-3">{profile.accountNumberMasked ?? "—"}</td>
                  <td className="px-3 py-3">{payoutProfileStatusLabel(profile.status, t)}</td>
                  <td className="px-3 py-3">{formatTradeDate(profile.updatedAt, locale)}</td>
                  <td className="px-3 py-3"><div className="flex gap-2"><button type="button" onClick={() => void action(profile.id, "verify")} className="inline-flex size-8 items-center justify-center rounded border text-emerald-700" aria-label={t("payouts.profile.verify")}><Check className="size-4" /></button><button type="button" onClick={() => void action(profile.id, "reject")} className="inline-flex size-8 items-center justify-center rounded border text-red-700" aria-label={t("payouts.profile.reject")}><X className="size-4" /></button></div></td>
                </tr>
              )) : <tr><td colSpan={headers.length} className="p-8 text-center theme-muted">{t("payouts.profile.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
