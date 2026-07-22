"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type LandingState =
  | "guest"
  | "eligible"
  | "pendingReview"
  | "active"
  | "suspended"
  | "rejected"
  | "unavailable";

export function PartnerProgramLanding({ state }: { state: LandingState }) {
  const { locale, t } = useI18n();
  const partnerJoinPath = withLocale("/onboarding/partner", locale);
  const signInPath = `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(partnerJoinPath)}`;

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
            <Link
              href={partnerJoinPath}
              className="rounded-md px-4 py-2.5 text-sm font-semibold theme-primary-button"
            >
              {t("partnerProgram.join")}
            </Link>
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
        {state === "pendingReview" || state === "suspended" || state === "rejected" ? (
          <div className="max-w-xl border-l-2 border-amber-500 pl-4">
            <p className="font-semibold theme-foreground">
              {t(`partnerProgram.${state === "pendingReview" ? "partnerStatusPendingReviewTitle" : state === "rejected" ? "partnerStatusRejectedTitle" : "suspendedTitle"}`)}
            </p>
            <p className="mt-1 text-sm leading-6 theme-muted">
              {t(`partnerProgram.${state === "pendingReview" ? "partnerStatusPendingReviewDescription" : state === "rejected" ? "partnerStatusRejectedDescription" : "suspendedDescription"}`)}
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
        <p className="max-w-3xl text-sm leading-6 theme-muted">
          {t("partnerProgram.disclosure")}
        </p>
      </section>
    </main>
  );
}
