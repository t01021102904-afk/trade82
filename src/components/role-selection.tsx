"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

type Role = "buyer" | "seller";
type RoleResponse = {
  role?: unknown;
  onboardingComplete?: unknown;
};

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
];

function debugRoleSelection(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[RoleSelection] ${message}`, details);
  }
}

export function RoleSelection({
  partnerProgramEnabled = false,
}: {
  partnerProgramEnabled?: boolean;
}) {
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

      const payload = (await response.json().catch(() => null)) as
        | (RoleResponse & { error?: string })
        | null;

      if (!response.ok) {
        setError(
          `${t("onboarding.roleError")} (${response.status}${payload?.error ? `: ${payload.error}` : ""})`,
        );
        setStatus("");
        setPendingRole(null);
        return;
      }

      await user?.reload();
      const savedRole =
        payload?.role === "buyer" || payload?.role === "seller"
          ? payload.role
          : role;
      const nextRoute =
        payload?.onboardingComplete === true
          ? withLocale("/dashboard", locale)
          : withLocale(`/onboarding/${savedRole}`, locale);
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
    <div className="mx-auto grid w-full max-w-[860px] gap-5">
      <OnboardingStepper current="role" />
      <section
        id="onboarding-current-step"
        className="scroll-mt-28 grid gap-4 rounded-2xl border p-5 theme-surface-elevated sm:p-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] theme-success-text">
            {t("onboarding.pathPickerLabel")}
          </p>
          <h2 className="mt-2 text-xl font-semibold theme-foreground">
            {t("onboarding.pathPickerTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
            {t("onboarding.pathPickerText")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roleCards.map((card) => {
            const loading = pendingRole === card.role;

            return (
              <button
                key={card.role}
                type="button"
                disabled={pendingRole !== null}
                onClick={() => chooseRole(card.role)}
                className={cx(
                  "group grid min-h-[176px] min-w-0 gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
                  loading
                    ? card.tone === "emerald"
                      ? "border-emerald-400/60 ring-4 ring-emerald-400/10"
                      : "border-blue-400/60 ring-4 ring-blue-400/10"
                    : "theme-surface theme-card-hover",
                  pendingRole !== null ? "cursor-wait opacity-80" : "",
                )}
              >
                <span className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <span
                    className={cx(
                      "inline-flex size-9 items-center justify-center rounded-xl border text-sm font-semibold",
                      card.tone === "emerald"
                        ? "theme-success-badge"
                        : "theme-info-badge",
                    )}
                  >
                    {card.role === "seller" ? "S" : "B"}
                  </span>
                  <span className="max-w-full shrink-0 break-words rounded-full border px-2.5 py-1 text-[11px] font-semibold theme-surface-muted">
                    {t(card.eyebrowKey)}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-base font-semibold theme-foreground">
                    {t(card.titleKey)}
                  </span>
                  <span className="mt-2 block break-words text-sm leading-6 theme-muted">
                    {t(card.descriptionKey)}
                  </span>
                </span>
                <span className="inline-flex h-9 w-fit items-center justify-center rounded-xl border px-3 text-sm font-semibold theme-surface-muted transition group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)]">
                  {loading ? t("onboarding.savingRole") : t(card.buttonKey)}
                </span>
              </button>
            );
          })}
        </div>
        {partnerProgramEnabled ? (
          <div className="flex justify-center pt-1">
            <Link
              href={withLocale("/partner", locale)}
              className="rounded px-2 py-1 text-sm font-medium theme-muted underline-offset-4 transition hover:text-[#25825f] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              {t("partnerProgram.joinAsPartner")}
            </Link>
          </div>
        ) : null}
      </section>
      {status || error ? (
        <div
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm",
            error
              ? "theme-danger-badge"
              : "theme-info-badge",
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
