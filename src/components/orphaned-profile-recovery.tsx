"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type RecoveryState = "idle" | "working" | "error";

const errorMessages: Record<string, string> = {
  authentication_required: "auth.accountRecoveryUnavailable",
  verified_email_required: "auth.accountRecoveryNoVerifiedEmail",
  existing_active_account: "auth.accountRecoveryExisting",
  recovery_in_progress: "auth.accountRecoveryInProgress",
  recovery_not_found: "auth.accountRecoveryNotFound",
  recovery_not_available: "auth.accountRecoveryUnavailable",
  invalid_request: "auth.accountRecoveryUnavailable",
  recovery_unavailable: "auth.accountRecoveryUnavailable",
};

export function OrphanedProfileRecovery() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<RecoveryState>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function recover() {
    setState("working");
    setErrorKey(null);

    try {
      const response = await fetch("/api/account/recover-orphaned-profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: unknown;
        errorCode?: unknown;
      } | null;

      if (response.ok && body?.ok === true) {
        window.location.assign(withLocale("/onboarding/role", locale));
        return;
      }

      const code = typeof body?.errorCode === "string" ? body.errorCode : null;
      setErrorKey(errorMessages[code ?? ""] ?? "auth.accountRecoveryUnavailable");
      setState("error");
    } catch {
      setErrorKey("auth.accountRecoveryUnavailable");
      setState("error");
    }
  }

  return (
    <main className="min-h-[640px] bg-zinc-50 px-4 py-16 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-blue-700">
          {t("auth.accountRecoveryLabel")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-950">
          {t("auth.accountRecoveryTitle")}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          {t("auth.accountRecoveryText")}
        </p>
        <button
          type="button"
          onClick={recover}
          disabled={state === "working"}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "working"
            ? t("auth.accountRecoveryWorking")
            : t("auth.accountRecoveryButton")}
        </button>
        {state === "error" && errorKey ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {t(errorKey)}
          </p>
        ) : null}
      </section>
    </main>
  );
}
