"use client";

import { FormEvent, useState } from "react";
import { useClerk } from "@clerk/nextjs";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

async function readJsonError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return result?.error ?? fallback;
}

export function DeleteAccountDangerZone() {
  const { locale, t } = useI18n();
  const { signOut } = useClerk();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const requiredConfirmation =
    locale === "ko" ? "계정 탈퇴" : "DELETE MY ACCOUNT";
  const canDelete = confirmation.trim() === requiredConfirmation && !deleting;

  function clearDeletedAccountBrowserState() {
    document.cookie = "trade82_referral_claim=; Max-Age=0; Path=/; SameSite=Lax";
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("trade82_") || key.startsWith("onboarding")) {
          storage.removeItem(key);
        }
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleting) return;
    setError("");

    if (confirmation.trim() !== requiredConfirmation) {
      setError(t("settings.deleteAccountConfirmationMismatch"));
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      if (!response.ok) {
        setError(await readJsonError(response, t("settings.deleteAccountError")));
        return;
      }

      clearDeletedAccountBrowserState();
      const onboardingPath = withLocale("/onboarding/role", locale);
      const signupPath = withLocale("/signup", locale);
      const redirectUrl = `${signupPath}?accountDeleted=1&redirect_url=${encodeURIComponent(onboardingPath)}`;
      await signOut().catch(() => undefined);
      window.location.replace(redirectUrl);
    } catch {
      setError(t("settings.deleteAccountError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid max-w-3xl gap-4 rounded-lg border border-red-200 bg-white p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
          {t("settings.dangerZone")}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-950">
          {t("settings.deleteAccountTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t("settings.deleteAccountDescription")}
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
        <li>{t("settings.deleteAccountRemovesPublicData")}</li>
        <li>{t("settings.deleteAccountRemovesUploads")}</li>
        <li>{t("settings.deleteAccountKeepsHistory")}</li>
      </ul>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">
            {t("settings.deleteAccountConfirmationLabel")}
          </span>
          <input
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError("");
            }}
            placeholder={requiredConfirmation}
            autoComplete="off"
            className="h-11 rounded-md border border-red-200 px-3 text-zinc-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </label>
        <p className="text-xs text-zinc-500">
          {t("settings.deleteAccountConfirmationHelper")}{" "}
          <span className="font-semibold text-zinc-800">
            {requiredConfirmation}
          </span>
        </p>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div>
          <button
            type="submit"
            disabled={!canDelete}
            className="rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting
              ? t("settings.deletingAccount")
              : t("settings.deleteAccountButton")}
          </button>
        </div>
      </form>
    </section>
  );
}
