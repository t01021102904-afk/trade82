"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import type { Product } from "@/lib/types";
import { safeInternalPath } from "@/lib/url-security";
import { cn } from "@/lib/utils";

type InquiryResponse = {
  id?: string;
  messageRoute?: string;
  error?: string;
  code?: string;
  action?: string;
  role?: "seller" | "buyer";
};

export function ProductInquiryComposer({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { context: userContext, isLoaded, isSignedIn } = useUserContext();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<"seller" | "buyer" | null>(
    null,
  );
  const redirecting = useRef(false);
  const queuedSubmit = useRef(false);
  const isAdmin = userContext?.isAdmin === true;

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined" || redirecting.current) return;
    redirecting.current = true;
    const currentUrl = safeInternalPath(
      `${pathname}${window.location.search}`,
      "/",
    );
    window.location.assign(
      `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(currentUrl)}`,
    );
  }, [locale, pathname]);

  const sendInquiry = useCallback(async () => {
    const trimmedMessage = message.trim();
    setError(null);
    setProfileRole(null);

    if (!trimmedMessage) {
      setError(t("contact.requiredField"));
      return;
    }

    if (!isSignedIn) {
      redirectToLogin();
      return;
    }

    if (!product.id || !product.sellerId) {
      setError(t("contact.unavailable"));
      return;
    }

    const ownsTarget = userContext?.companies.some(
      (company) => company.id === product.sellerId,
    );
    if (!isAdmin && ownsTarget) {
      setError(t("contact.ownCompany"));
      return;
    }

    const hasBuyerCompany = userContext?.companies.some(
      (company) => company.companyRole === "buyer",
    );
    if (!isAdmin && userContext && !hasBuyerCompany) {
      setProfileRole("buyer");
      setError(t("contact.completeProfileBeforeContact"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCompanyId: product.sellerId,
          productId: product.id,
          message: trimmedMessage,
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
  }, [
    isAdmin,
    isSignedIn,
    locale,
    message,
    product.id,
    product.sellerId,
    redirectToLogin,
    router,
    t,
    userContext,
  ]);

  useEffect(() => {
    if (!isLoaded || !queuedSubmit.current) return;
    queuedSubmit.current = false;
    queueMicrotask(() => {
      setWaitingForSession(false);
      void sendInquiry();
    });
  }, [isLoaded, sendInquiry]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || waitingForSession || !message.trim()) return;

    if (!isLoaded) {
      queuedSubmit.current = true;
      setWaitingForSession(true);
      setError(null);
      setProfileRole(null);
      return;
    }

    void sendInquiry();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form onSubmit={submit} className={cn("min-w-0", className)}>
      <Field>
        <FieldLabel htmlFor={`product-message-${product.id}`}>
          {t("contact.message")}
        </FieldLabel>
        <FieldDescription>
          {t("contact.messageDescription")}
        </FieldDescription>
        <div className="relative">
          <Textarea
            id={`product-message-${product.id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("contact.messagePlaceholder")}
            maxLength={2_000}
            className="min-h-36 resize-none pb-16 pr-28"
          />
          <Button
            type="submit"
            disabled={submitting || waitingForSession || !message.trim()}
            className="absolute bottom-3 right-3 h-9 rounded-lg px-4"
          >
            <SendIcon />
            <span>{t("contact.send")}</span>
          </Button>
        </div>
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive"
          >
            {error}
            {profileRole ? (
              <Link
                href={withLocale(`/onboarding/${profileRole}`, locale)}
                className="mt-2 block font-medium underline underline-offset-2"
              >
                {t("contact.completeProfile")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Field>
    </form>
  );
}

function SendIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.4995 13.5001L20.9995 3.00005M10.6271 13.8281L13.2552 20.5861C13.4867 21.1815 13.6025 21.4791 13.7693 21.566C13.9139 21.6414 14.0862 21.6415 14.2308 21.5663C14.3977 21.4796 14.5139 21.1821 14.7461 20.587L21.3364 3.69925C21.5461 3.16207 21.6509 2.89348 21.5935 2.72185C21.5437 2.5728 21.4268 2.45583 21.2777 2.40604C21.1061 2.34871 20.8375 2.45352 20.3003 2.66315L3.41258 9.25349C2.8175 9.48572 2.51997 9.60183 2.43326 9.76873C2.35809 9.91342 2.35819 10.0857 2.43353 10.2303C2.52043 10.3971 2.81811 10.5128 3.41345 10.7444L10.1715 13.3725C10.2923 13.4195 10.3527 13.443 10.4036 13.4793C10.4487 13.5114 10.4881 13.5509 10.5203 13.596C10.5566 13.6468 10.5801 13.7073 10.6271 13.8281Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
