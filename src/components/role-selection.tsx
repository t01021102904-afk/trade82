"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { OnboardingStoryPanel } from "@/components/onboarding-story-panel";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

type Role = "buyer" | "seller";

const roleCards: Array<{
  role: Role;
  titleKey: string;
  descriptionKey: string;
  buttonKey: string;
  eyebrowKey: string;
  tone: "blue" | "emerald";
}> = [
  {
    role: "seller",
    titleKey: "onboarding.roleSupplierCardTitle",
    descriptionKey: "onboarding.roleSellerDescription",
    buttonKey: "onboarding.continueAsSeller",
    eyebrowKey: "onboarding.roleSupplierEyebrow",
    tone: "emerald",
  },
  {
    role: "buyer",
    titleKey: "onboarding.roleBuyerCardTitle",
    descriptionKey: "onboarding.roleBuyerDescription",
    buttonKey: "onboarding.continueAsBuyer",
    eyebrowKey: "onboarding.roleBuyerEyebrow",
    tone: "blue",
  },
  {
    role: "seller",
    titleKey: "onboarding.roleListProductsTitle",
    descriptionKey: "onboarding.roleListProductsDescription",
    buttonKey: "onboarding.ctaStartListingProducts",
    eyebrowKey: "onboarding.roleSellerTitle",
    tone: "emerald",
  },
  {
    role: "buyer",
    titleKey: "onboarding.roleFindProductsTitle",
    descriptionKey: "onboarding.roleFindProductsDescription",
    buttonKey: "onboarding.roleFindProductsCta",
    eyebrowKey: "onboarding.roleBuyerTitle",
    tone: "blue",
  },
];

function debugRoleSelection(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[RoleSelection] ${message}`, details);
  }
}

export function RoleSelection() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const queuedRole = useRef<Role | null>(null);
  const redirecting = useRef(false);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined" || redirecting.current) return;
    redirecting.current = true;
    const currentUrl = safeInternalPath(`${pathname}${window.location.search}`, "/onboarding/role");
    window.location.assign(
      `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(currentUrl)}`,
    );
  }, [locale, pathname]);

  const saveRole = useCallback(async (role: Role) => {
    setPendingRole(role);
    setError("");
    setStatus(statusText(locale, "callingApi"));
    debugRoleSelection("calling /api/user/role", { role });

    try {
      const response = await fetch("/api/user/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      debugRoleSelection("/api/user/role response", {
        role,
        status: response.status,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(
          `${t("onboarding.roleError")} (${response.status}${payload?.error ? `: ${payload.error}` : ""})`,
        );
        setStatus("");
        setPendingRole(null);
        return;
      }

      await user?.reload();
      const nextRoute = withLocale(`/onboarding/${role}`, locale);
      debugRoleSelection("pushing route", { role, nextRoute });
      setStatus(statusText(locale, "navigating", nextRoute));
      router.push(nextRoute);
    } catch {
      debugRoleSelection("/api/user/role request failed", { role });
      setError(t("onboarding.roleError"));
      setStatus("");
      setPendingRole(null);
    }
  }, [locale, router, t, user]);

  useEffect(() => {
    if (!isLoaded || !queuedRole.current) return;

    const role = queuedRole.current;
    queuedRole.current = null;
    queueMicrotask(() => {
      void saveRole(role);
    });
  }, [isLoaded, saveRole]);

  function chooseRole(role: Role) {
    debugRoleSelection("button clicked", {
      role,
      isLoaded,
      isSignedIn,
      hasUser: Boolean(user),
    });
    if (pendingRole) return;

    if (!isLoaded) {
      queuedRole.current = role;
      setPendingRole(role);
      setError("");
      setStatus(statusText(locale, "preparing"));
      return;
    }

    if (!isSignedIn || !user) {
      setPendingRole(role);
      setStatus(statusText(locale, "redirectingLogin"));
      redirectToLogin();
      return;
    }

    void saveRole(role);
  }

  return (
    <div className="grid gap-6">
      <OnboardingStepper current="role" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <section id="onboarding-current-step" className="scroll-mt-28 grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              {t("onboarding.pathPickerLabel")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {t("onboarding.pathPickerTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              {t("onboarding.pathPickerText")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {roleCards.map((card) => {
              const loading = pendingRole === card.role;

              return (
                <article
                  key={`${card.role}-${card.titleKey}`}
                  className={cx(
                    "group grid min-h-60 gap-5 rounded-2xl border bg-white/[0.045] p-5 shadow-2xl shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white/[0.07]",
                    loading
                      ? card.tone === "emerald"
                        ? "border-emerald-300/60 ring-4 ring-emerald-300/10"
                        : "border-blue-300/60 ring-4 ring-blue-300/10"
                      : "border-white/10 hover:border-white/20",
                  )}
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cx(
                          "inline-flex size-10 items-center justify-center rounded-xl text-sm font-semibold",
                          card.tone === "emerald"
                            ? "bg-emerald-300 text-zinc-950"
                            : "bg-blue-300 text-zinc-950",
                        )}
                      >
                        {card.role === "seller" ? "S" : "B"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-zinc-950/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-400">
                        {t(card.eyebrowKey)}
                      </span>
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-white">
                      {t(card.titleKey)}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {t(card.descriptionKey)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pendingRole !== null}
                    onClick={() => chooseRole(card.role)}
                    className={cx(
                      "relative z-10 inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
                      loading
                        ? "bg-white text-zinc-950"
                        : "border border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white hover:text-zinc-950",
                      pendingRole !== null ? "cursor-wait opacity-80" : "",
                    )}
                  >
                    {loading ? t("onboarding.savingRole") : t(card.buttonKey)}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <OnboardingStoryPanel kind="role" />
      </div>
      {status || error ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm",
            error
              ? "border-red-300/25 bg-red-300/10 text-red-100"
              : "border-blue-300/25 bg-blue-300/10 text-blue-100",
          )}
          role={error ? "alert" : "status"}
        >
          {error || status}
        </div>
      ) : null}
    </div>
  );
}

function statusText(
  locale: "en" | "ko",
  state: "preparing" | "callingApi" | "navigating" | "redirectingLogin",
  route?: string,
) {
  if (locale === "ko") {
    if (state === "preparing") return "버튼 클릭이 감지되었습니다. 계정을 준비하는 중입니다...";
    if (state === "callingApi") return "계정 유형을 저장하는 중입니다...";
    if (state === "navigating") return `${route ?? "다음 단계"}로 이동하는 중입니다...`;
    return "로그인이 필요합니다. 로그인 화면으로 이동합니다...";
  }

  if (state === "preparing") return "Button click received. Preparing your account...";
  if (state === "callingApi") return "Saving your account type...";
  if (state === "navigating") return `Moving to ${route ?? "the next step"}...`;
  return "Sign-in is required. Redirecting to login...";
}
