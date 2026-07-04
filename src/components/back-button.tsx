"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

function safeFallbackHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  if (trimmed.includes("\\")) return "/";
  return trimmed;
}

export function BackButton({
  fallbackHref = "/",
  label,
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const buttonLabel = label ?? t("common.back");
  const localizedFallback = withLocale(safeFallbackHref(fallbackHref), locale);

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(localizedFallback);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cx(
        "inline-flex h-8 w-fit items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition theme-secondary-button hover:-translate-y-0.5",
        className,
      )}
      aria-label={buttonLabel}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {buttonLabel}
    </button>
  );
}
