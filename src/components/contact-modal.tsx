"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import type { Buyer, Product, Seller } from "@/lib/types";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

type ContactContext =
  | { type: "product"; product?: Product | null }
  | { type: "seller"; seller?: Seller | null }
  | { type: "buyer"; buyer?: Buyer | null };

type InquiryResponse = {
  id?: string;
  messageRoute?: string;
  error?: string;
  code?: string;
  action?: string;
  role?: "seller" | "buyer";
};

function contextDetails(context: ContactContext) {
  if (context.type === "product") {
    const product = context.product;
    return {
      valid: Boolean(product?.id && product?.sellerId),
      productId: product?.id,
      targetCompanyId: product?.sellerId,
      targetRole: "seller" as const,
    };
  }

  if (context.type === "seller") {
    const seller = context.seller;
    return {
      valid: Boolean(seller?.id),
      productId: undefined,
      targetCompanyId: seller?.id,
      targetRole: "seller" as const,
    };
  }

  const buyer = context.buyer;
  return {
    valid: Boolean(buyer?.id),
    productId: undefined,
    targetCompanyId: buyer?.id,
    targetRole: "buyer" as const,
  };
}

export function ContactModal({
  context,
  buttonLabel,
  className,
  variant = "primary",
}: {
  context: ContactContext;
  buttonLabel: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { context: userContext, isLoaded, isSignedIn } = useUserContext();
  const [submitting, setSubmitting] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<"seller" | "buyer" | null>(
    null,
  );
  const redirecting = useRef(false);
  const queuedOpen = useRef(false);
  const details = useMemo(() => contextDetails(context), [context]);
  const isAdmin = userContext?.isAdmin === true;

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined" || redirecting.current) return;
    redirecting.current = true;
    const currentUrl = safeInternalPath(`${pathname}${window.location.search}`, "/");
    window.location.assign(
      `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(currentUrl)}`,
    );
  }, [locale, pathname]);

  function profileRoute(role: "seller" | "buyer") {
    return withLocale(`/onboarding/${role}`, locale);
  }

  const startConversation = useCallback(async () => {
    setError(null);
    setProfileRole(null);

    if (!isSignedIn) {
      redirectToLogin();
      return;
    }

    if (!details.valid || !details.targetCompanyId) {
      setError(t("contact.unavailable"));
      return;
    }

    const ownsTarget = userContext?.companies.some(
      (company) => company.id === details.targetCompanyId,
    );
    if (!isAdmin && ownsTarget) {
      setError(t("contact.ownCompany"));
      return;
    }

    const requiredSenderRole =
      details.targetRole === "seller" ? "buyer" : "seller";
    const hasSenderCompany = userContext?.companies.some(
      (company) => company.companyRole === requiredSenderRole,
    );
    if (!isAdmin && userContext && !hasSenderCompany) {
      setProfileRole(requiredSenderRole);
      setError(t("contact.completeProfileBeforeContact"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCompanyId: details.targetCompanyId,
          productId: details.productId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as InquiryResponse;

      if (response.ok && payload.id) {
        const route = payload.messageRoute ?? `/messages?inquiryId=${payload.id}`;
        router.push(withLocale(safeInternalPath(route, "/messages"), locale));
        return;
      }

      if (payload.code === "own_company") {
        setError(t("contact.ownCompany"));
        return;
      }

      if (
        payload.action === "complete_profile" &&
        (payload.role === "seller" || payload.role === "buyer")
      ) {
        setProfileRole(payload.role);
        setError(t("contact.completeProfileBeforeContact"));
        return;
      }

      setError(payload.error || t("contact.startChatFailed"));
    } catch {
      setError(t("contact.startChatFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [details, isAdmin, isSignedIn, locale, redirectToLogin, router, t, userContext]);

  useEffect(() => {
    if (!isLoaded || !queuedOpen.current) return;
    queuedOpen.current = false;
    queueMicrotask(() => {
      setWaitingForSession(false);
      void startConversation();
    });
  }, [isLoaded, startConversation]);

  async function openConversation(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (submitting || waitingForSession) return;
    if (!isLoaded) {
      queuedOpen.current = true;
      setWaitingForSession(true);
      setError(null);
      setProfileRole(null);
      return;
    }

    await startConversation();
  }

  return (
    <span className="inline-flex min-w-0 flex-col gap-2">
      <button
        type="button"
        disabled={submitting || waitingForSession}
        onClick={(event) => void openConversation(event)}
        className={cx(
          "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70",
          variant === "primary"
            ? "bg-zinc-950 text-white hover:bg-blue-700"
            : "border border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700",
          className,
        )}
      >
        {submitting || waitingForSession ? t("contact.openingConversation") : buttonLabel}
      </button>
      {error ? (
        <span className="max-w-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
          {profileRole ? (
            <Link
              href={profileRoute(profileRole)}
              className="mt-2 block font-medium text-red-800 underline underline-offset-2"
              onClick={(event) => event.stopPropagation()}
            >
              {t("contact.completeProfile")}
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
