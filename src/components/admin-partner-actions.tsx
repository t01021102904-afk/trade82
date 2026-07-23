"use client";

import { useState } from "react";

import { createTranslator, getDictionary, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  partnerProfileId: string;
  partnerStatus: string;
  payoutProfileId: string | null;
  payoutStatus: string | null;
};

type ActionResult = { ok?: boolean; status?: string; accountNumber?: string; error?: string };

export function AdminPartnerActions({
  locale,
  partnerProfileId,
  partnerStatus,
  payoutProfileId,
  payoutStatus,
}: Props) {
  const t = createTranslator(getDictionary(locale));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  async function post(path: string, body: Record<string, string>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ActionResult;
      if (!response.ok || result.ok !== true) {
        setMessage(t("admin.partnerActionError"));
        return;
      }
      setMessage(t("admin.partnerActionSuccess"));
      window.location.reload();
    } catch {
      setMessage(t("admin.partnerActionError"));
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!payoutProfileId || !reason.trim()) {
      setMessage(t("admin.partnerReasonRequired"));
      return;
    }
    setBusy(true);
    setMessage(null);
    setRevealed(null);
    try {
      const response = await fetch(
        `/api/admin/partner-payout-profile/${encodeURIComponent(payoutProfileId)}/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as ActionResult;
      if (!response.ok || typeof result.accountNumber !== "string") {
        setMessage(t("admin.partnerActionError"));
        return;
      }
      setRevealed(result.accountNumber);
    } catch {
      setMessage(t("admin.partnerActionError"));
    } finally {
      setBusy(false);
    }
  }

  const partnerPath = `/api/admin/partners/${encodeURIComponent(partnerProfileId)}`;
  return (
    <div className="mt-5 grid gap-3 border-t pt-4 theme-border">
      <label className="grid gap-1 text-sm theme-foreground">
        {t("admin.partnerActionReason")}
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          className="min-h-9 rounded-md border px-3 theme-border theme-surface"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {partnerStatus === "SUSPENDED" ? (
          <ActionButton disabled={busy} onClick={() => post(partnerPath, { action: "reactivate" })} label={t("admin.partnerReactivate")} />
        ) : null}
        {partnerStatus === "ACTIVE" ? (
          <ActionButton
            disabled={busy || !reason.trim()}
            onClick={() => post(partnerPath, { action: "suspend", reason })}
            label={t("admin.partnerSuspend")}
          />
        ) : null}
      </div>
      {payoutProfileId ? (
        <div className="flex flex-wrap items-center gap-2">
          {payoutStatus === "PENDING_VERIFICATION" ? (
            <ActionButton disabled={busy} onClick={() => post(`/api/admin/partner-payout-profile/${encodeURIComponent(payoutProfileId)}`, { action: "verify" })} label={t("admin.partnerPayoutVerify")} />
          ) : null}
          {payoutStatus !== "DISABLED" ? (
            <ActionButton disabled={busy || !reason.trim()} onClick={() => post(`/api/admin/partner-payout-profile/${encodeURIComponent(payoutProfileId)}`, { action: "disable", reason })} label={t("admin.partnerPayoutDisable")} />
          ) : null}
          {payoutStatus !== "REJECTED" ? (
            <ActionButton disabled={busy || !reason.trim()} onClick={() => post(`/api/admin/partner-payout-profile/${encodeURIComponent(payoutProfileId)}`, { action: "reject", reason })} label={t("admin.partnerPayoutReject")} />
          ) : null}
          <ActionButton disabled={busy || !reason.trim()} onClick={reveal} label={t("admin.partnerRevealAccount")} />
        </div>
      ) : null}
      {revealed ? <p className="font-mono text-sm theme-foreground">{t("admin.partnerPayoutAccountNumber")}: {revealed}</p> : null}
      {message ? <p role="status" className="text-sm theme-muted">{message}</p> : null}
    </div>
  );
}

function ActionButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-8 rounded-md border px-3 text-xs font-medium theme-border theme-secondary-button disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
