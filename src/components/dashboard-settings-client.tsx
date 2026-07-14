"use client";

import {
  ArrowRight,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BackButton } from "@/components/back-button";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

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

type SettingsActionCardProps = {
  title: string;
  description: string;
  rightLabel: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function DashboardSettingsClient({
  role,
  sellerCompany,
  locale,
}: {
  role: "buyer" | "seller" | "both" | "admin" | "user";
  sellerCompany: SellerBillingCompany | null;
  locale: Locale;
}) {
  const pathname = usePathname();
  const messages = getDictionary(locale);
  const [billingPending, setBillingPending] = useState(false);
  const [billingError, setBillingError] = useState("");
  const buyerOnly = role === "buyer";
  const sellerDashboardHref = withLocale("/dashboard/seller", locale);
  const billingActive = hasActiveBilling(sellerCompany);

  async function openBillingPortal() {
    setBillingPending(true);
    setBillingError("");

    try {
      const response = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: pathname }),
      });
      const result = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok || !result?.url) {
        setBillingError(result?.error ?? "Billing portal could not be opened.");
        return;
      }

      window.location.assign(result.url);
    } catch {
      setBillingError("Billing portal could not be opened.");
    } finally {
      setBillingPending(false);
    }
  }

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <BackButton fallbackHref="/dashboard" className="mb-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-success-text">
            {buyerOnly
              ? messages.settings.buyerDashboard
              : messages.settings.sellerDashboard}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight theme-foreground">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-muted">
            Manage billing, company details, products, documents, matching, and account access.
          </p>
        </div>

        {billingError ? (
          <p
            role="alert"
            className="rounded-xl border px-4 py-3 text-sm theme-danger-badge"
          >
            {billingError}
          </p>
        ) : null}

        <section className="grid gap-3" aria-label="Settings menu">
          <SettingsActionCard
            title="Billing & Subscription"
            description="Plan, invoices, payment method, billing address, and cancellation."
            rightLabel={billingActive ? "Active" : "Manage"}
            icon={CreditCard}
            onClick={() => void openBillingPortal()}
            loading={billingPending}
          />
          <SettingsActionCard
            title="Company"
            description="How your company appears to buyers on Trade82."
            rightLabel="Edit"
            icon={Building2}
            href={withLocale("/settings/company", locale)}
          />
          <SettingsActionCard
            title="Products"
            description="Product listings, MOQ, samples, pricing, and buyer-facing details."
            rightLabel="Products"
            icon={Package}
            href={`${sellerDashboardHref}?section=products`}
          />
          <SettingsActionCard
            title="Documents"
            description="Catalogs, certificates, COA, MSDS/SDS, labels, and buyer files."
            rightLabel="Files"
            icon={FileText}
            href={`${sellerDashboardHref}?section=documents`}
          />
          {!buyerOnly ? (
            <SettingsActionCard
              title="Payout Information"
              description="Encrypted bank instructions and verification status for manual seller payouts."
              rightLabel="Edit"
              icon={CreditCard}
              href={withLocale("/settings/payout-information", locale)}
            />
          ) : null}
          <SettingsActionCard
            title="Matching Preferences"
            description="Control how Trade82 matches your products with buyer RFQs."
            rightLabel="Edit"
            icon={SlidersHorizontal}
            href={withLocale("/dashboard/settings/matching-preferences", locale)}
          />
          <SettingsActionCard
            title="Account & Security"
            description="Email, password, login, and account access."
            rightLabel="Manage"
            icon={ShieldCheck}
            href={withLocale("/settings/profile", locale)}
          />
        </section>
      </div>
    </div>
  );
}

function SettingsActionCard({
  title,
  description,
  rightLabel,
  icon: Icon,
  href,
  onClick,
  disabled = false,
  loading = false,
}: SettingsActionCardProps) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border theme-surface-muted">
        <Icon className="size-4 theme-muted" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold theme-foreground">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 theme-muted">
          {description}
        </span>
      </span>
      <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-sm font-semibold theme-muted">
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            {rightLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </span>
    </>
  );
  const className = cx(
    "group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition theme-surface-elevated",
    "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
    disabled || loading ? "cursor-wait opacity-70" : "cursor-pointer",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {content}
    </button>
  );
}

function hasActiveBilling(company: SellerBillingCompany | null) {
  if (!company) return false;
  return (
    company.subscriptionStatus === "active" ||
    company.subscriptionStatus === "trialing"
  );
}

export type { SellerBillingCompany };
