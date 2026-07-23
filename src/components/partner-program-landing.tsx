"use client";

import { ArrowRight } from "lucide-react";
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

const steps = [1, 2, 3] as const;

export function PartnerProgramLanding({ state }: { state: LandingState }) {
  const { locale, t } = useI18n();
  const partnerJoinPath = withLocale("/onboarding/partner", locale);
  const signUpPath = `${withLocale("/signup", locale)}?redirect_url=${encodeURIComponent(partnerJoinPath)}`;
  const signInPath = `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(partnerJoinPath)}`;
  const dashboardPath = withLocale("/partner/dashboard", locale);
  const primaryHref =
    state === "guest"
      ? signUpPath
      : state === "eligible"
        ? partnerJoinPath
        : state === "active"
          ? dashboardPath
          : null;
  const primaryLabel =
    state === "active"
      ? t("partnerProgram.dashboard")
      : t("partnerProgram.landingPrimaryCta");

  const statusMessage =
    state === "pendingReview"
      ? {
          title: t("partnerProgram.partnerStatusPendingReviewTitle"),
          description: t("partnerProgram.partnerStatusPendingReviewDescription"),
        }
      : state === "rejected"
        ? {
            title: t("partnerProgram.partnerStatusRejectedTitle"),
            description: t("partnerProgram.partnerStatusRejectedDescription"),
          }
        : state === "suspended"
          ? {
              title: t("partnerProgram.suspendedTitle"),
              description: t("partnerProgram.suspendedDescription"),
            }
          : state === "unavailable"
            ? {
                title: t("partnerProgram.unavailableTitle"),
                description: t("partnerProgram.unavailable"),
              }
            : null;

  return (
    <main className="theme-bg text-zinc-950">
      <section className="border-b theme-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight theme-foreground sm:text-5xl">
            {t("partnerProgram.landingHeroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 theme-muted sm:text-lg">
            {t("partnerProgram.landingHeroDescription")}
          </p>

          <ol
            id="partner-program-steps"
            className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3"
          >
            {steps.map((step) => (
              <li
                key={step}
                className="rounded-xl border p-4 theme-border theme-surface-elevated"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                  {step}
                </span>
                <p className="mt-4 text-sm font-semibold leading-6 theme-foreground">
                  {t(`partnerProgram.landingStep${step}`)}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-2xl text-xs leading-5 theme-muted">
            {t("partnerProgram.landingDisclosure")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {primaryHref ? (
              <Link
                href={primaryHref}
                className="inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-semibold theme-primary-button"
              >
                {primaryLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            {state === "guest" ? (
              <Link
                href={signInPath}
                className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-[#25825f] underline underline-offset-4"
              >
                {t("partnerProgram.landingSignIn")}
              </Link>
            ) : null}
          </div>

          {statusMessage ? (
            <div className="mt-8 w-full max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-amber-950">{statusMessage.title}</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">{statusMessage.description}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
