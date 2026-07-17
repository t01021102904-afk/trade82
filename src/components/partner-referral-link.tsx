"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";

export function PartnerReferralLink({ referralUrl }: { referralUrl: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border px-3 py-2 text-sm theme-surface-muted theme-foreground">{referralUrl}</code>
      <button type="button" onClick={() => void copy()} className="h-9 rounded-md border px-3 text-sm font-medium theme-border theme-muted hover:text-[var(--foreground)]">
        {copied ? t("partnerProgram.copied") : t("partnerProgram.copy")}
      </button>
    </div>
  );
}
