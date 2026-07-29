"use client";

import { Landmark, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CometSpinner } from "@/components/ui/comet-spinner";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withLocale } from "@/lib/i18n";
import {
  formatTradeDateTime,
  payoutProfileStatusLabel,
} from "@/lib/trade-order-i18n";

type Bank = {
  id: string;
  bankNameLocal: string;
  bankNameEnglish: string;
};

type Profile = {
  bankDirectoryId: string | null;
  accountHolder: string;
  accountNumberMasked: string | null;
  accountBelongsToCompany: boolean;
  status: string;
  updatedAt: string;
};

const emptyProfile: Profile = {
  bankDirectoryId: null,
  accountHolder: "",
  accountNumberMasked: null,
  accountBelongsToCompany: false,
  status: "DRAFT",
  updatedAt: "",
};

function onlyAccountNumberCharacters(value: string) {
  return value.replace(/[^0-9-]/g, "");
}

export function PayoutInformationClient({
  locale: pageLocale,
}: {
  locale?: "en" | "ko";
}) {
  const { locale: contextLocale, t } = useI18n();
  const locale = pageLocale ?? contextLocale;
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [accountNumber, setAccountNumber] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/account/payout-profile", { cache: "no-store" })
      .then(async (response) => ({
        response,
        data: await response.json().catch(() => null),
      }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(t("payouts.loadError"));
          return;
        }
        if (data?.profile) {
          setProfile({ ...emptyProfile, ...data.profile });
        }
      })
      .catch(() => {
        if (active) setError(t("payouts.loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/payout-banks", { cache: "no-store" })
      .then(async (response) => ({
        response,
        data: await response.json().catch(() => null),
      }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(t("payouts.bankLoadError"));
          return;
        }
        setBanks(data?.banks ?? []);
      })
      .catch(() => {
        if (active) setError(t("payouts.bankLoadError"));
      })
      .finally(() => {
        if (active) setBanksLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (
      !profile.accountBelongsToCompany ||
      !termsAccepted ||
      !privacyAccepted
    ) {
      setError(t("payouts.requiredConsents"));
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/account/payout-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "KR",
          bankDirectoryId: profile.bankDirectoryId,
          accountHolder: profile.accountHolder,
          ...(accountNumber ? { accountNumber } : {}),
          accountType: "LOCAL",
          payoutCurrency: "krw",
          supportedCurrencies: ["krw"],
          accountBelongsToCompany: profile.accountBelongsToCompany,
          termsAccepted,
          privacyAccepted,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(t("payouts.saveError"));
        return;
      }

      setProfile({ ...emptyProfile, ...data.profile });
      setAccountNumber("");
      setNotice(t("payouts.savedNotice"));
    } catch {
      setError(t("payouts.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="flex min-h-48 items-center justify-center"
        aria-label={t("payouts.loading")}
      >
        <CometSpinner size="xs" />
      </div>
    );
  }

  const bankSelectionDisabled =
    saving || banksLoading || banks.length === 0;
  const bankOptions = banks.map((bank) => ({
    value: bank.id,
    label:
      locale === "ko"
        ? `${bank.bankNameLocal} (${bank.bankNameEnglish})`
        : `${bank.bankNameEnglish} (${bank.bankNameLocal})`,
  }));

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("payouts.informationTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("payouts.informationDescription")}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {notice}
        </p>
      ) : null}

      <form
        className="mt-6 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
        onSubmit={save}
      >
        <FieldGroup>
          <FieldSet>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <Landmark className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 space-y-1">
                  <FieldLegend>{t("payouts.beneficiaryDetails")}</FieldLegend>
                  <FieldDescription>
                    {profile.accountNumberMasked
                      ? `${t("payouts.savedAccount")}: ${profile.accountNumberMasked}`
                      : t("payouts.enterAccountNumber")}
                  </FieldDescription>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                {payoutProfileStatusLabel(profile.status, t)}
              </span>
            </div>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="settlement-country">
                  {t("payouts.country")}
                </FieldLabel>
                <Input
                  id="settlement-country"
                  value={t("payouts.korea")}
                  readOnly
                  aria-readonly="true"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-bank">
                  {t("payouts.bank")}
                </FieldLabel>
                <Select
                  items={bankOptions}
                  value={profile.bankDirectoryId ?? ""}
                  onValueChange={(value) =>
                    update("bankDirectoryId", value || null)
                  }
                  disabled={bankSelectionDisabled}
                  required
                >
                  <SelectTrigger
                    id="settlement-bank"
                    className="w-full"
                    aria-label={t("payouts.bank")}
                  >
                    <SelectValue
                      placeholder={
                        banksLoading
                          ? t("payouts.loadingBanks")
                          : t("payouts.selectBank")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      {bankOptions.map((bank) => (
                        <SelectItem key={bank.value} value={bank.value}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {!banksLoading && banks.length === 0 ? (
                  <FieldDescription className="text-destructive">
                    {t("payouts.noBanksAvailable")}
                  </FieldDescription>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-account-holder">
                  {t("payouts.accountHolder")}
                </FieldLabel>
                <Input
                  id="settlement-account-holder"
                  value={profile.accountHolder}
                  onChange={(event) =>
                    update("accountHolder", event.target.value)
                  }
                  required
                  maxLength={240}
                  disabled={saving}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-account-number">
                  {profile.accountNumberMasked
                    ? t("payouts.replaceAccountNumber")
                    : t("payouts.accountNumber")}
                </FieldLabel>
                <Input
                  id="settlement-account-number"
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(
                      onlyAccountNumberCharacters(event.target.value)
                    )
                  }
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9-]*"
                  placeholder={profile.accountNumberMasked ?? ""}
                  minLength={profile.accountNumberMasked ? undefined : 4}
                  maxLength={127}
                  required={!profile.accountNumberMasked}
                  disabled={saving}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-currency">
                  {t("payouts.payoutCurrency")}
                </FieldLabel>
                <Input
                  id="settlement-currency"
                  value="KRW"
                  readOnly
                  aria-readonly="true"
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <FieldSet>
            <div className="space-y-1">
              <FieldLegend>
                {t("payouts.requiredConfirmations")}
              </FieldLegend>
              <FieldDescription>
                {t("payouts.requiredConfirmationsDescription")}
              </FieldDescription>
            </div>

            <FieldGroup className="gap-3">
              <ConsentField
                id="settlement-account-ownership"
                checked={profile.accountBelongsToCompany}
                disabled={saving}
                onChange={(checked) =>
                  update("accountBelongsToCompany", checked)
                }
              >
                {t("payouts.accountBelongsToCompany")}
              </ConsentField>

              <ConsentField
                id="settlement-terms"
                checked={termsAccepted}
                disabled={saving}
                onChange={setTermsAccepted}
              >
                {locale === "ko" ? (
                  <>
                    <a
                      href={withLocale("/terms", locale)}
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      이용약관
                    </a>
                    에 동의합니다. (필수)
                  </>
                ) : (
                  <>
                    I agree to the{" "}
                    <a
                      href={withLocale("/terms", locale)}
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Terms of Service
                    </a>
                    . (Required)
                  </>
                )}
              </ConsentField>

              <ConsentField
                id="settlement-privacy"
                checked={privacyAccepted}
                disabled={saving}
                onChange={setPrivacyAccepted}
              >
                {locale === "ko" ? (
                  <>
                    <a
                      href={withLocale("/privacy", locale)}
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      개인정보처리방침
                    </a>
                    을 확인했습니다. (필수)
                  </>
                ) : (
                  <>
                    I acknowledge the{" "}
                    <a
                      href={withLocale("/privacy", locale)}
                      target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Privacy Policy
                    </a>
                    . (Required)
                  </>
                )}
              </ConsentField>
            </FieldGroup>
          </FieldSet>

          <FieldSeparator />

          <Field
            orientation="horizontal"
            className="flex-wrap items-center justify-between gap-3"
          >
            <FieldDescription>
              {profile.updatedAt
                ? `${t("payouts.lastUpdated")}: ${formatTradeDateTime(
                    profile.updatedAt,
                    locale
                  )}`
                : ""}
            </FieldDescription>
            <Button
              type="submit"
              size="lg"
              disabled={saving || banksLoading || banks.length === 0}
            >
              <Save data-icon="inline-start" />
              {saving ? t("payouts.saving") : t("payouts.save")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </section>
  );
}

function ConsentField({
  id,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
        disabled={disabled}
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className="min-w-0 cursor-pointer text-sm font-normal leading-5 text-foreground"
      >
        {children}
      </Label>
    </div>
  );
}
