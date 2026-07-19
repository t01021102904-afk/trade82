"use client";

import { ArrowUpRight, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";

type MerchantAccount = {
  exists: boolean;
  country: string;
  status: "ONBOARDING_INCOMPLETE" | "UNDER_REVIEW" | "ENABLED" | "RESTRICTED" | "DISABLED";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  cardPaymentsEnabled: boolean;
  transfersEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  requirementsOutstanding: boolean;
};

type StatusResponse = {
  enabled: boolean;
  account: MerchantAccount | null;
};

const fallbackStatus: MerchantAccount = {
  exists: false,
  country: "",
  status: "ONBOARDING_INCOMPLETE",
  chargesEnabled: false,
  payoutsEnabled: false,
  cardPaymentsEnabled: false,
  transfersEnabled: false,
  detailsSubmitted: false,
  onboardingComplete: false,
  requirementsOutstanding: false,
};

export function SellerStripeMerchantAccountPanel() {
  const { locale, t } = useI18n();
  const [response, setResponse] = useState<StatusResponse | null>(null);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/stripe/connect/merchant/status", { cache: "no-store" })
      .then((result) => {
        if (!result.ok) throw new Error("status");
        return result.json() as Promise<StatusResponse>;
      })
      .then((nextResponse) => {
        if (cancelled) return;
        setError(false);
        setResponse(nextResponse);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startOnboarding() {
    setStarting(true);
    setError(false);
    try {
      const result = await fetch(
        `/api/stripe/connect/merchant/start?locale=${locale}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const payload = (await result.json().catch(() => null)) as
        | { url?: unknown }
        | null;
      if (!result.ok || typeof payload?.url !== "string") throw new Error("start");
      window.location.assign(payload.url);
    } catch {
      setError(true);
      setStarting(false);
    }
  }

  const account = response?.account ?? fallbackStatus;
  const statusLabel = response?.enabled
    ? t(`stripeDirectChargeMerchant.status.${account.status}`)
    : t("stripeDirectChargeMerchant.status.notStarted");
  const statusDescription = response?.enabled
    ? t(`stripeDirectChargeMerchant.statusDescription.${account.status}`)
    : t("stripeDirectChargeMerchant.maintenance");
  const disabled =
    starting ||
    !response?.enabled ||
    account.status === "DISABLED" ||
    account.onboardingComplete;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {t("stripeDirectChargeMerchant.eyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950">
            {t("stripeDirectChargeMerchant.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            {t("stripeDirectChargeMerchant.description")}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700">
          {account.status === "ENABLED" ? (
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
          ) : (
            <CircleAlert aria-hidden="true" className="h-4 w-4 text-zinc-500" />
          )}
          {statusLabel}
        </span>
      </div>

      <p className="mt-5 text-sm text-zinc-600">{statusDescription}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator
          label={t("stripeDirectChargeMerchant.indicators.cardPayments")}
          enabled={account.cardPaymentsEnabled}
        />
        <Indicator
          label={t("stripeDirectChargeMerchant.indicators.bankPayouts")}
          enabled={account.payoutsEnabled}
        />
        <Indicator
          label={t("stripeDirectChargeMerchant.indicators.informationSubmitted")}
          enabled={account.detailsSubmitted}
        />
        <Indicator
          label={t("stripeDirectChargeMerchant.indicators.requirements")}
          enabled={!account.requirementsOutstanding}
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {t("stripeDirectChargeMerchant.error")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!account.onboardingComplete && (
          <button
            type="button"
            onClick={() => void startOnboarding()}
            disabled={disabled}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {account.exists
              ? t("stripeDirectChargeMerchant.continue")
              : t("stripeDirectChargeMerchant.start")}
            {!starting && <ArrowUpRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        )}
        <p className="text-xs text-zinc-500">
          {t("stripeDirectChargeMerchant.noFinancialAction")}
        </p>
      </div>
    </section>
  );
}

function Indicator({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      {enabled ? (
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-zinc-400" />
      )}
      <span className="text-sm font-medium text-zinc-700">{label}</span>
    </div>
  );
}
