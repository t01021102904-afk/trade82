"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { ProfilePreviewPanel } from "@/components/premium-motion";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

type Role = "buyer" | "seller";

const roleCards: Array<{
  role: Role;
  titleKey: string;
  descriptionKey: string;
  buttonKey: string;
}> = [
  {
    role: "buyer",
    titleKey: "onboarding.roleBuyerTitle",
    descriptionKey: "onboarding.roleBuyerDescription",
    buttonKey: "onboarding.continueAsBuyer",
  },
  {
    role: "seller",
    titleKey: "onboarding.roleSellerTitle",
    descriptionKey: "onboarding.roleSellerDescription",
    buttonKey: "onboarding.continueAsSeller",
  },
];

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
    console.log("[RoleSelection] calling /api/user/role", { role });

    try {
      const response = await fetch("/api/user/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      console.log("[RoleSelection] /api/user/role response", {
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
      console.log("[RoleSelection] pushing route", { role, nextRoute });
      setStatus(statusText(locale, "navigating", nextRoute));
      router.push(nextRoute);
    } catch {
      console.log("[RoleSelection] /api/user/role request failed", { role });
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
    console.log("[RoleSelection] button clicked", {
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
      <div className="grid gap-5 md:grid-cols-2">
        {roleCards.map((card) => {
          const loading = pendingRole === card.role;

          return (
            <article
              key={card.role}
              className={cx(
                "bm-premium-card grid gap-5 rounded-lg border bg-white p-6 shadow-sm shadow-zinc-100",
                loading ? "border-blue-300 ring-4 ring-blue-100" : "border-zinc-200",
              )}
            >
              <div className="relative z-10">
                <span
                  className={cx(
                    "mb-5 inline-flex size-10 items-center justify-center rounded-md text-sm font-semibold",
                    card.role === "seller"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-blue-50 text-blue-800",
                  )}
                >
                  {card.role === "seller" ? "S" : "B"}
                </span>
                <h2 className="text-2xl font-semibold text-zinc-950">
                  {t(card.titleKey)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {t(card.descriptionKey)}
                </p>
              </div>
              <button
                type="button"
                disabled={pendingRole !== null}
                onClick={() => chooseRole(card.role)}
                className={cx(
                  "relative z-10 inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-white transition",
                  loading ? "bg-blue-700" : "bg-zinc-950 hover:bg-blue-700",
                  pendingRole !== null ? "cursor-wait opacity-80" : "",
                )}
              >
                {loading ? t("onboarding.savingRole") : t(card.buttonKey)}
              </button>
            </article>
          );
        })}
      </div>
      {status || error ? (
        <div
          className={cx(
            "rounded-md border px-4 py-3 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-800",
          )}
          role={error ? "alert" : "status"}
        >
          {error || status}
        </div>
      ) : null}
      <section className="bm-premium-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-100">
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="relative z-10">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Trade82
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">
              {t("onboarding.processTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {t("onboarding.processText")}
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-2 text-xs text-zinc-600">
            {[
              t("onboarding.processStep1"),
              t("onboarding.processStep2"),
              t("onboarding.processStep3"),
              t("onboarding.processStep4"),
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-blue-200 hover:bg-white"
              >
                <span className="mb-2 flex size-6 items-center justify-center rounded-full bg-emerald-50 font-semibold text-emerald-800">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>
      <ProfilePreviewPanel
        kind="seller"
        title={t("onboarding.previewTitle")}
        subtitle={t("onboarding.previewText")}
        badgeLabel={t("roles.koreanSeller")}
      />
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
