"use client";

import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Handshake,
  Link2,
  Megaphone,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HomeFaqAccordion } from "@/components/home-landing-interactions";
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

type LandingCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

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

  const benefits: LandingCard[] = [
    {
      icon: UserPlus,
      title: t("partnerProgram.benefitEasySignup"),
      description: t("partnerProgram.benefitEasySignupDescription"),
    },
    {
      icon: Link2,
      title: t("partnerProgram.benefitShareLink"),
      description: t("partnerProgram.benefitShareLinkDescription"),
    },
    {
      icon: WalletCards,
      title: t("partnerProgram.benefitEarn"),
      description: t("partnerProgram.benefitEarnDescription"),
    },
    {
      icon: BarChart3,
      title: t("partnerProgram.benefitTracking"),
      description: t("partnerProgram.benefitTrackingDescription"),
    },
  ];

  const steps: LandingCard[] = [
    {
      icon: UserPlus,
      title: t("partnerProgram.howStep1Title"),
      description: t("partnerProgram.howStep1Description"),
    },
    {
      icon: Link2,
      title: t("partnerProgram.howStep2Title"),
      description: t("partnerProgram.howStep2Description"),
    },
    {
      icon: Users,
      title: t("partnerProgram.howStep3Title"),
      description: t("partnerProgram.howStep3Description"),
    },
    {
      icon: CheckCircle2,
      title: t("partnerProgram.howStep4Title"),
      description: t("partnerProgram.howStep4Description"),
    },
  ];

  const audiences: LandingCard[] = [
    {
      icon: Megaphone,
      title: t("partnerProgram.audienceInfluencers"),
      description: t("partnerProgram.audienceInfluencersDescription"),
    },
    {
      icon: Building2,
      title: t("partnerProgram.audienceConsultants"),
      description: t("partnerProgram.audienceConsultantsDescription"),
    },
    {
      icon: Handshake,
      title: t("partnerProgram.audienceAgencies"),
      description: t("partnerProgram.audienceAgenciesDescription"),
    },
    {
      icon: Users,
      title: t("partnerProgram.audienceConnectors"),
      description: t("partnerProgram.audienceConnectorsDescription"),
    },
  ];

  const faqs = [1, 2, 3, 4, 5, 6, 7].map((index) => ({
    question: t(`partnerProgram.faq${index}Question`),
    answer: t(`partnerProgram.faq${index}Answer`),
  }));

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
      <section className="bm-grid-surface border-b theme-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
              {t("partnerProgram.landingHeroEyebrow")}
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight theme-foreground sm:text-6xl">
              {t("partnerProgram.landingHeroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 theme-muted sm:text-lg">
              {t("partnerProgram.landingHeroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryHref ? (
                <Link
                  href={primaryHref}
                  className="inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-semibold theme-primary-button"
                >
                  {primaryLabel}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-semibold theme-border theme-surface-elevated theme-foreground"
              >
                {t("partnerProgram.landingSecondaryCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              {state === "guest" ? (
                <Link
                  href={signInPath}
                  className="inline-flex h-11 items-center rounded-md px-2 text-sm font-semibold text-[#25825f] underline underline-offset-4"
                >
                  {t("partnerProgram.landingSignIn")}
                </Link>
              ) : null}
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 theme-muted">
              {t("partnerProgram.disclosure")}
            </p>
            {statusMessage ? (
              <div className="mt-7 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-950">{statusMessage.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">{statusMessage.description}</p>
              </div>
            ) : null}
          </div>

          <div className="relative min-h-[340px] overflow-hidden rounded-[1.5rem] border bg-white p-3 shadow-sm sm:min-h-[440px] sm:p-5">
            <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden="true" />
            <div className="relative h-full min-h-[310px] overflow-hidden rounded-[1.15rem] border theme-border theme-surface-muted sm:min-h-[400px]">
              <Image
                src="/landing/export-documents.png"
                alt={t("partnerProgram.landingHeroAlt")}
                width={1448}
                height={1086}
                priority
                sizes="(min-width: 1024px) 520px, 92vw"
                className="absolute inset-0 h-full w-full object-contain p-5 sm:p-8"
              />
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl border bg-white/95 px-3 py-2 shadow-sm sm:left-6 sm:top-6">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Link2 className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold theme-foreground">{t("partnerProgram.visualReferralLink")}</span>
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border bg-white/95 px-3 py-2 shadow-sm sm:bottom-6 sm:right-6">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <BarChart3 className="size-4" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold theme-foreground">{t("partnerProgram.visualEarnings")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
            {t("partnerProgram.landingBenefitsEyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
            {t("partnerProgram.landingBenefitsTitle")}
          </h2>
          <p className="mt-4 text-sm leading-6 theme-muted sm:text-base">
            {t("partnerProgram.landingBenefitsDescription")}
          </p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border p-5 theme-border theme-surface-elevated">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-base font-semibold theme-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y theme-border theme-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
              {t("partnerProgram.landingHowEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
              {t("partnerProgram.landingHowTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 theme-muted sm:text-base">
              {t("partnerProgram.landingHowDescription")}
            </p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="relative rounded-2xl border bg-white p-5 theme-border">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <Icon className="size-5 text-emerald-700" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-base font-semibold theme-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
            {t("partnerProgram.landingAudienceEyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
            {t("partnerProgram.landingAudienceTitle")}
          </h2>
          <p className="mt-4 text-sm leading-6 theme-muted sm:text-base">
            {t("partnerProgram.landingAudienceDescription")}
          </p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border p-5 theme-border theme-surface-elevated">
              <Icon className="size-5 text-emerald-700" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold theme-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y theme-border theme-surface-muted">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
              {t("partnerProgram.landingEarningsEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
              {t("partnerProgram.landingEarningsTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 theme-muted sm:text-base">
              {t("partnerProgram.landingEarningsDescription")}
            </p>
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {t("partnerProgram.landingPayoutNote")}
            </p>
          </div>
          <div className="grid gap-3">
            {(
              [
                { icon: CheckCircle2, key: "earningsRecorded" },
                { icon: ShieldCheck, key: "earningsReview" },
                { icon: WalletCards, key: "earningsPayout" },
              ] satisfies Array<{ icon: LucideIcon; key: string }>
            ).map(({ icon: Icon, key }) => {
              return (
                <article key={key} className="flex gap-4 rounded-2xl border bg-white p-5 theme-border">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold theme-foreground">
                      {t(`partnerProgram.${key}`)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 theme-muted">
                      {t(`partnerProgram.${key}Description`)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#25825f]">
            {t("partnerProgram.landingFaqEyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
            {t("partnerProgram.landingFaqTitle")}
          </h2>
        </div>
        <div className="mt-8 rounded-2xl border bg-white px-4 theme-border sm:px-6">
          <HomeFaqAccordion items={faqs} />
        </div>
      </section>

      <section className="border-t theme-border bg-emerald-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {t("partnerProgram.landingFinalEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight theme-foreground sm:text-4xl">
              {t("partnerProgram.landingFinalTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 theme-muted sm:text-base">
              {t("partnerProgram.landingFinalDescription")}
            </p>
          </div>
          {primaryHref ? (
            <Link
              href={primaryHref}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold theme-primary-button"
            >
              {state === "active" ? t("partnerProgram.dashboard") : t("partnerProgram.landingFinalCta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
