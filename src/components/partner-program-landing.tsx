"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type LandingState =
  "guest" | "eligible" | "active" | "suspended" | "unavailable";

export function PartnerProgramLanding({ state }: { state: LandingState }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const partnerPath = withLocale("/partner", locale);
  const signInPath = `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(partnerPath)}`;

  async function enroll() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/partner/enroll", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(
          response.status === 403
            ? t("partnerProgram.unavailable")
            : (payload?.error ?? t("partnerProgram.enrollError")),
        );
        return;
      }
      router.replace(withLocale("/partner/dashboard", locale));
      router.refresh();
    } catch {
      setError(t("partnerProgram.enrollError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bm-grid-surface min-h-[calc(100vh-4rem)] theme-bg">
      <section className="mx-auto grid max-w-4xl gap-6 px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#25825f]">
            {t("partnerProgram.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-5xl">
            {t("partnerProgram.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 theme-muted">
            {t("partnerProgram.description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {state === "guest" ? (
            <Link
              href={signInPath}
              className="rounded-md px-4 py-2.5 text-sm font-semibold theme-primary-button"
            >
              {t("partnerProgram.signIn")}
            </Link>
          ) : null}
          {state === "eligible" ? (
            <button
              type="button"
              onClick={() => void enroll()}
              disabled={submitting}
              className="rounded-md px-4 py-2.5 text-sm font-semibold theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? t("partnerProgram.joining")
                : t("partnerProgram.join")}
            </button>
          ) : null}
          {state === "active" ? (
            <Link
              href={withLocale("/partner/dashboard", locale)}
              className="rounded-md px-4 py-2.5 text-sm font-semibold theme-primary-button"
            >
              {t("partnerProgram.dashboard")}
            </Link>
          ) : null}
        </div>
        {state === "suspended" ? (
          <div className="max-w-xl border-l-2 border-amber-500 pl-4">
            <p className="font-semibold theme-foreground">
              {t("partnerProgram.suspendedTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 theme-muted">
              {t("partnerProgram.suspendedDescription")}
            </p>
          </div>
        ) : null}
        {state === "unavailable" ? (
          <div className="max-w-xl border-l-2 border-zinc-400 pl-4">
            <p className="font-semibold theme-foreground">
              {t("partnerProgram.unavailableTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 theme-muted">
              {t("partnerProgram.unavailable")}
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p className="max-w-3xl text-sm leading-6 theme-muted">
          {t("partnerProgram.disclosure")}
        </p>
      </section>
    </main>
  );
}
