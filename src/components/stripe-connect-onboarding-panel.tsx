"use client";

import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";

type OwnerType = "seller" | "partner";

type AccountState = {
  exists: boolean;
  status: "PENDING" | "RESTRICTED" | "ENABLED" | "DISABLED";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
};

type StatusResponse = {
  enabled: boolean;
  account: AccountState | null;
  error?: string;
};

export function StripeConnectOnboardingPanel({ ownerType }: { ownerType: OwnerType }) {
  const { t } = useI18n();
  const [response, setResponse] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const endpoint = `/api/stripe/connect/onboarding/${ownerType}`;
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch(`${endpoint}/status`, { cache: "no-store" });
      const data = (await result.json().catch(() => null)) as StatusResponse | null;
      if (!result.ok || !data) {
        setError(data?.error ?? t("stripeConnectOnboarding.loadError"));
        return;
      }
      setResponse(data);
      setError("");
    } catch {
      setError(t("stripeConnectOnboarding.loadError"));
    } finally {
      setLoading(false);
    }
  }, [endpoint, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  async function start() {
    if (starting || response?.enabled === false) return;
    setStarting(true);
    setError("");
    try {
      const result = await fetch(`${endpoint}/start`, { method: "POST" });
      const data = (await result.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!result.ok || !data?.url) {
        setError(data?.error ?? t("stripeConnectOnboarding.startError"));
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError(t("stripeConnectOnboarding.startError"));
    } finally {
      setStarting(false);
    }
  }

  const account = response?.account;
  const title = ownerType === "seller"
    ? t("stripeConnectOnboarding.sellerTitle")
    : t("stripeConnectOnboarding.partnerTitle");
  const description = ownerType === "seller"
    ? t("stripeConnectOnboarding.sellerDescription")
    : t("stripeConnectOnboarding.partnerDescription");

  return (
    <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6" aria-labelledby={`stripe-connect-${ownerType}`}>
      <div className="rounded-2xl border p-5 theme-surface-elevated">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border theme-surface-muted">
              <CreditCard className="size-5 theme-success-text" aria-hidden="true" />
            </span>
            <div>
              <h2 id={`stripe-connect-${ownerType}`} className="font-semibold theme-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-6 theme-muted">{description}</p>
            </div>
          </div>
          {account ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold theme-success-badge">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t(`stripeConnectOnboarding.status.${account.status}`)}
            </span>
          ) : null}
        </div>

        {loading ? <div className="mt-4 flex items-center gap-2 text-sm theme-muted"><Loader2 className="size-4 animate-spin" />{t("stripeConnectOnboarding.loading")}</div> : null}
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
        {!loading && response?.enabled === false ? <p className="mt-4 text-sm theme-muted">{t("stripeConnectOnboarding.maintenance")}</p> : null}
        {!loading && response?.enabled && account ? (
          <p className="mt-4 text-sm theme-muted">
            {account.onboardingComplete
              ? t("stripeConnectOnboarding.completeDescription")
              : t("stripeConnectOnboarding.incompleteDescription")}
          </p>
        ) : null}

        {!loading && response?.enabled ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={starting || account?.onboardingComplete || account?.status === "DISABLED"}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {account?.exists ? t("stripeConnectOnboarding.continue") : t("stripeConnectOnboarding.setup")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
