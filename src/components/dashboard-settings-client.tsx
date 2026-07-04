"use client";

import {
  Building2,
  CreditCard,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { BackButton } from "@/components/back-button";
import { DeleteAccountDangerZone } from "@/components/delete-account-danger-zone";
import { VerifiedSellerBadge } from "@/components/verified-seller-badge";
import {
  hasBillingPaymentIssue,
  isVerifiedSellerSubscription,
} from "@/lib/billing";
import { withLocale, type Locale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

type SettingsTab = "account" | "company" | "billing" | "security";

type SellerBillingCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  verifiedSellerSince: string | null;
};

const tabs: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "security", label: "Security", icon: LockKeyhole },
];

export function DashboardSettingsClient({
  activeTab,
  role,
  sellerCompany,
  locale,
}: {
  activeTab: SettingsTab;
  role: "buyer" | "seller" | "both" | "admin" | "user";
  sellerCompany: SellerBillingCompany | null;
  locale: Locale;
}) {
  const basePath = withLocale("/dashboard/settings", locale);

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <BackButton fallbackHref="/dashboard" className="mb-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            Seller dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight theme-foreground">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
            Manage account, company profile, billing, and security settings for Trade82.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-2xl border p-2 theme-surface-elevated">
            <nav
              className="-mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0"
              aria-label="Settings"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={`${basePath}?tab=${tab.id}`}
                    className={cx(
                      "inline-flex h-9 min-w-max items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition",
                      selected
                        ? "theme-primary-button shadow-sm"
                        : "theme-ghost-button hover:-translate-y-0.5",
                    )}
                    aria-current={selected ? "page" : undefined}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="grid gap-4">
            {activeTab === "account" ? (
              <SettingsCard
                title="Account"
                description="Update your public contact information and professional profile."
              >
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={withLocale("/settings/profile", locale)}
                    className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold theme-primary-button"
                  >
                    Edit account profile
                  </Link>
                </div>
              </SettingsCard>
            ) : null}

            {activeTab === "company" ? (
              <SettingsCard
                title="Company Profile"
                description="Manage company details, marketplace profile fields, and seller profile information."
              >
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={withLocale("/settings/company", locale)}
                    className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold theme-primary-button"
                  >
                    Edit company profile
                  </Link>
                </div>
              </SettingsCard>
            ) : null}

            {activeTab === "billing" ? (
              <BillingPanel
                role={role}
                sellerCompany={sellerCompany}
                locale={locale}
              />
            ) : null}

            {activeTab === "security" ? (
              <>
                <SettingsCard
                  title="Security"
                  description="Trade82 account sign-in, sessions, and authentication are managed through Clerk."
                >
                  <p className="text-sm leading-6 theme-muted">
                    Use the account menu to manage sign-in methods and active sessions.
                    Trade82 never stores raw card data or authentication secrets.
                  </p>
                </SettingsCard>
                <DeleteAccountDangerZone />
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-5 theme-surface-elevated">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold theme-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 theme-muted">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BillingPanel({
  role,
  sellerCompany,
  locale,
}: {
  role: string;
  sellerCompany: SellerBillingCompany | null;
  locale: Locale;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");
  const active = isVerifiedSellerSubscription(
    sellerCompany?.subscriptionStatus,
    sellerCompany?.subscriptionPlan,
  );
  const paymentIssue = hasBillingPaymentIssue(sellerCompany?.subscriptionStatus);
  const nextBillingDate = useMemo(
    () => formatBillingDate(sellerCompany?.subscriptionCurrentPeriodEnd, locale),
    [locale, sellerCompany?.subscriptionCurrentPeriodEnd],
  );
  const sellerEligible = role === "seller" || role === "both";

  async function startBilling(endpoint: string, kind: "checkout" | "portal") {
    setPending(kind);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: pathname }),
      });
      const result = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok || !result?.url) {
        setError(result?.error ?? "Billing request failed.");
        return;
      }

      window.location.assign(result.url);
    } catch {
      setError("Billing request failed.");
    } finally {
      setPending(null);
    }
  }

  if (!sellerEligible) {
    return (
      <SettingsCard
        title="Billing"
        description="Billing is currently available for sellers."
      >
        <p className="text-sm theme-muted">Buyer billing controls are hidden.</p>
      </SettingsCard>
    );
  }

  return (
    <div className="grid gap-4">
      <SettingsCard
        title="Billing"
        description="Subscribe through Stripe Checkout and manage payment methods, invoices, cancellation, and card updates in the Stripe Customer Portal."
      >
        <div className="rounded-2xl border p-5 theme-surface">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold theme-foreground">
                  Verified Seller
                </h3>
                {active ? <VerifiedSellerBadge compact /> : null}
                {paymentIssue ? (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold theme-warning-badge">
                    Payment issue
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-semibold theme-foreground">
                $49<span className="text-sm font-medium theme-muted">/month</span>
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
                Get a Verified Seller badge, improve buyer trust, and unlock
                priority visibility.
              </p>
            </div>
            <div className="min-w-0 rounded-xl border px-4 py-3 theme-surface-muted sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] theme-muted">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold theme-foreground">
                {active
                  ? "Active"
                  : paymentIssue
                    ? "Payment issue"
                    : "Inactive"}
              </p>
              {nextBillingDate ? (
                <p className="mt-1 text-xs theme-muted">
                  Next billing date: {nextBillingDate}
                </p>
              ) : null}
            </div>
          </div>

          <ul className="mt-5 grid gap-2 text-sm theme-muted sm:grid-cols-2">
            <li>Verified Seller badge</li>
            <li>Better buyer trust</li>
            <li>Priority visibility</li>
            <li>More complete seller profile</li>
          </ul>

          {paymentIssue ? (
            <div className="mt-5 rounded-xl border p-4 theme-warning-badge">
              <p className="text-sm font-semibold">Payment issue</p>
              <p className="mt-1 text-sm">
                Your Verified Seller status may be paused if payment is not resolved.
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-xl border px-4 py-3 text-sm theme-danger-badge">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {active || paymentIssue ? (
              <button
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  void startBilling(
                    "/api/billing/create-portal-session",
                    "portal",
                  )
                }
                className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold theme-primary-button disabled:cursor-wait disabled:opacity-70"
              >
                {pending === "portal"
                  ? "Opening..."
                  : paymentIssue
                    ? "Update payment method"
                    : "Manage billing"}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending !== null || !sellerCompany}
                onClick={() =>
                  void startBilling(
                    "/api/billing/create-checkout-session",
                    "checkout",
                  )
                }
                className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold theme-primary-button disabled:cursor-wait disabled:opacity-70"
              >
                {pending === "checkout" ? "Opening..." : "Become Verified Seller"}
              </button>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

function formatBillingDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export type { SettingsTab, SellerBillingCompany };
