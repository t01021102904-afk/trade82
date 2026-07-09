"use client";

import { LockKeyhole } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

export function WholesalePriceGate({
  value,
  className,
  valueClassName,
  gateClassName,
}: {
  value: string;
  className?: string;
  valueClassName?: string;
  gateClassName?: string;
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const shouldGate = !isLoaded || !isSignedIn;

  function openSignup() {
    const currentPath = safeInternalPath(
      `${pathname || "/"}${window.location.search}`,
      "/",
    );
    window.location.assign(
      `${withLocale("/signup", locale)}?redirect_url=${encodeURIComponent(currentPath)}`,
    );
  }

  if (!shouldGate) {
    return (
      <span className={cx("inline-block min-w-0 break-words", className, valueClassName)}>
        {value}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openSignup();
      }}
      className={cx(
        "inline-flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 theme-focus theme-foreground",
        className,
        gateClassName,
      )}
      aria-label={t("productDetail.signupToViewWholesalePrice")}
      title={t("productDetail.signupToViewWholesalePrice")}
    >
      <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{t("productDetail.seeWholesalePrice")}</span>
    </button>
  );
}
