import "server-only";

import Stripe from "stripe";
import {
  Prisma,
  type PrismaClient,
  type SellerStripeMerchantAccount,
  type SellerStripeMerchantAccountStatus,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  isStripeConnectOnboardingEnabled,
  type StripeConnectOnboardingMode,
} from "@/lib/stripe-connect-onboarding-feature";
import { normalizeStripeConnectCountry } from "@/lib/stripe-connect-onboarding";
import { assertStripeConnectRuntimeConfiguration } from "@/lib/stripe-connect-runtime-mode";

type Db = PrismaClient;
type TransactionDb = Prisma.TransactionClient;
type StripeDirectChargeMerchantClient = Pick<Stripe, "accounts" | "accountLinks">;

type MerchantAccountSnapshot = Pick<
  SellerStripeMerchantAccount,
  | "status"
  | "chargesEnabled"
  | "payoutsEnabled"
  | "cardPaymentsEnabled"
  | "transfersEnabled"
  | "detailsSubmitted"
  | "onboardingComplete"
  | "country"
>;

export type SafeSellerStripeMerchantAccount = MerchantAccountSnapshot & {
  exists: boolean;
  requirementsOutstanding: boolean;
};

export type MerchantSettingsLocale = "en" | "ko";

export class StripeDirectChargeMerchantError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "StripeDirectChargeMerchantError";
  }
}

export function getStripeDirectChargeMerchantOnboardingMode(
  value = process.env.STRIPE_CONNECT_ONBOARDING_MODE,
): StripeConnectOnboardingMode {
  return value === "on" ? "on" : "off";
}

function assertMerchantOnboardingEnabled() {
  if (!isStripeConnectOnboardingEnabled()) {
    throw new StripeDirectChargeMerchantError(
      "Stripe payment account onboarding is not available.",
      403,
    );
  }
}

export function merchantAccountIdempotencyKey(companyId: string) {
  return `trade82-direct-charge-merchant:${companyId}:v1`;
}

type MerchantStripeAccount = Pick<
  Stripe.Account,
  | "id"
  | "country"
  | "charges_enabled"
  | "payouts_enabled"
  | "details_submitted"
  | "capabilities"
  | "requirements"
>;

function classifyDisabledReason(reason: string | null | undefined) {
  if (!reason) return "none" as const;
  if (
    reason === "rejected" ||
    reason === "listed" ||
    reason === "platform_paused" ||
    reason.startsWith("rejected.") ||
    reason.startsWith("listed.")
  ) {
    return "terminal" as const;
  }
  if (reason.startsWith("requirements.")) return "temporary" as const;
  return "unknown" as const;
}

export function mapSellerStripeMerchantAccount(
  account: MerchantStripeAccount,
): Pick<
  SellerStripeMerchantAccount,
  | "status"
  | "chargesEnabled"
  | "payoutsEnabled"
  | "cardPaymentsEnabled"
  | "transfersEnabled"
  | "detailsSubmitted"
  | "onboardingComplete"
> {
  const requirements = account.requirements;
  const currentlyDue = Boolean(requirements?.currently_due?.length);
  const pastDue = Boolean(requirements?.past_due?.length);
  const pendingVerification = Boolean(requirements?.pending_verification?.length);
  const detailsSubmitted = Boolean(account.details_submitted);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const cardPaymentsEnabled = account.capabilities?.card_payments === "active";
  const transfersEnabled = account.capabilities?.transfers === "active";
  const disabledReasonKind = classifyDisabledReason(requirements?.disabled_reason);
  const onboardingComplete =
    chargesEnabled &&
    payoutsEnabled &&
    cardPaymentsEnabled &&
    transfersEnabled &&
    detailsSubmitted &&
    !requirements?.disabled_reason &&
    !currentlyDue &&
    !pastDue &&
    !pendingVerification;

  let status: SellerStripeMerchantAccountStatus;
  if (disabledReasonKind === "terminal") {
    status = "DISABLED";
  } else if (onboardingComplete) {
    status = "ENABLED";
  } else if (pendingVerification) {
    status = "UNDER_REVIEW";
  } else if (!detailsSubmitted || currentlyDue || pastDue) {
    status = "ONBOARDING_INCOMPLETE";
  } else {
    // Unknown Stripe disabled reasons and incomplete capabilities fail closed.
    status = "RESTRICTED";
  }

  return {
    status,
    chargesEnabled,
    payoutsEnabled,
    cardPaymentsEnabled,
    transfersEnabled,
    detailsSubmitted,
    onboardingComplete,
  };
}

export function canContinueSellerMerchantOnboarding(
  account: Pick<SafeSellerStripeMerchantAccount, "status" | "onboardingComplete"> | null,
) {
  return Boolean(account && !account.onboardingComplete && account.status !== "DISABLED");
}

function safeAccount(
  account: SellerStripeMerchantAccount | null,
): SafeSellerStripeMerchantAccount {
  if (!account) {
    return {
      exists: false,
      country: "",
      status: "ONBOARDING_INCOMPLETE",
      chargesEnabled: false,
      payoutsEnabled: false,
      cardPaymentsEnabled: false,
      transfersEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
      requirementsOutstanding: false,
    };
  }

  return {
    exists: true,
    country: account.country,
    status: account.status,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    cardPaymentsEnabled: account.cardPaymentsEnabled,
    transfersEnabled: account.transfersEnabled,
    detailsSubmitted: account.detailsSubmitted,
    onboardingComplete: account.onboardingComplete,
    requirementsOutstanding: !account.onboardingComplete,
  };
}

async function resolveSellerCompany({ db, userId }: { db: Db; userId: string }) {
  const company = await db.company.findFirst({
    where: { ownerUserId: userId, companyRole: "seller", deletedAt: null },
    select: { id: true, country: true },
  });
  if (!company) {
    throw new StripeDirectChargeMerchantError(
      "Only the owner of a seller company can set up a Stripe payment account.",
      403,
    );
  }

  const country = normalizeStripeConnectCountry(company.country);
  if (!country) {
    throw new StripeDirectChargeMerchantError(
      "A valid seller company country is required before onboarding can begin.",
      400,
    );
  }
  return { ...company, country };
}

async function withCompanyLock<T>(
  db: Db,
  companyId: string,
  work: (tx: TransactionDb) => Promise<T>,
) {
  const lockKey = `trade82-direct-charge-merchant:${companyId}`;
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      return work(tx);
    },
    // The advisory lock serializes this company-scoped create-or-reuse path.
    // Read Committed lets a waiter observe the row committed by the lock owner
    // before it considers an external Stripe account creation.
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function createMerchantStripeAccount(
  stripe: StripeDirectChargeMerchantClient,
  company: { id: string; country: string },
) {
  return stripe.accounts.create(
    {
      country: company.country,
      controller: {
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "full" },
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        trade82_account_purpose: "seller_direct_charge_merchant",
        trade82_company_id: company.id,
      },
    },
    { idempotencyKey: merchantAccountIdempotencyKey(company.id) },
  );
}

async function findMerchantAccount(
  db: Pick<Db, "sellerStripeMerchantAccount">,
  companyId: string,
) {
  return db.sellerStripeMerchantAccount.findUnique({ where: { companyId } });
}

async function createOrReuseMerchantAccount({
  db,
  stripe,
  company,
}: {
  db: Db;
  stripe: StripeDirectChargeMerchantClient;
  company: { id: string; country: string };
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withCompanyLock(db, company.id, async (tx) => {
        const existing = await findMerchantAccount(tx, company.id);
        if (existing) return existing;

        const stripeAccount = await createMerchantStripeAccount(stripe, company);
        return tx.sellerStripeMerchantAccount.create({
          data: {
            companyId: company.id,
            stripeAccountId: stripeAccount.id,
            country: company.country,
            ...mapSellerStripeMerchantAccount(stripeAccount),
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await findMerchantAccount(db, company.id);
        if (existing) return existing;
      }
      if (isSerializationConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new StripeDirectChargeMerchantError(
    "Unable to set up the Stripe payment account.",
    503,
  );
}

function appOrigin() {
  const appUrl = new URL(getAppUrl());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname);
  if (!local && appUrl.protocol !== "https:") {
    throw new StripeDirectChargeMerchantError(
      "Stripe onboarding requires an HTTPS application URL.",
      503,
    );
  }
  return appUrl.origin;
}

function localeValue(locale: MerchantSettingsLocale | undefined) {
  return locale === "ko" ? "ko" : "en";
}

function onboardingUrls(locale: MerchantSettingsLocale | undefined) {
  const returnLocale = localeValue(locale);
  return {
    refreshUrl: `${appOrigin()}/api/stripe/connect/merchant/refresh`,
    returnUrl: `${appOrigin()}/api/stripe/connect/merchant/return?locale=${returnLocale}`,
  };
}

async function createMerchantOnboardingLink(
  stripe: StripeDirectChargeMerchantClient,
  stripeAccountId: string,
  locale: MerchantSettingsLocale | undefined,
) {
  const { refreshUrl, returnUrl } = onboardingUrls(locale);
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
    collection_options: { fields: "eventually_due" },
  });
}

export async function getSellerStripeMerchantAccountStatus({
  userId,
  db = getDb(),
}: {
  userId: string;
  db?: Db;
}) {
  const company = await resolveSellerCompany({ db, userId });
  return safeAccount(await findMerchantAccount(db, company.id));
}

export async function startSellerStripeMerchantOnboarding({
  userId,
  locale,
  db = getDb(),
  stripe,
}: {
  userId: string;
  locale?: MerchantSettingsLocale;
  db?: Db;
  stripe?: StripeDirectChargeMerchantClient;
}) {
  assertMerchantOnboardingEnabled();
  const company = await resolveSellerCompany({ db, userId });
  assertStripeConnectRuntimeConfiguration();
  const stripeClient = stripe ?? getStripe();
  const account = await createOrReuseMerchantAccount({ db, stripe: stripeClient, company });
  const link = await createMerchantOnboardingLink(
    stripeClient,
    account.stripeAccountId,
    locale,
  );
  return { url: link.url, account: safeAccount(account) };
}

export async function syncSellerStripeMerchantAccount({
  db = getDb(),
  account,
}: {
  db?: Db;
  account: Stripe.Account;
}) {
  const merchantModel = (db as Db & {
    sellerStripeMerchantAccount?: Db["sellerStripeMerchantAccount"];
  }).sellerStripeMerchantAccount;
  if (!merchantModel) return { found: false, updated: false, account: null } as const;

  const existing = await merchantModel.findUnique({
    where: { stripeAccountId: account.id },
  });
  if (!existing) return { found: false, updated: false, account: null } as const;

  const next = mapSellerStripeMerchantAccount(account);
  const unchanged =
    existing.status === next.status &&
    existing.chargesEnabled === next.chargesEnabled &&
    existing.payoutsEnabled === next.payoutsEnabled &&
    existing.cardPaymentsEnabled === next.cardPaymentsEnabled &&
    existing.transfersEnabled === next.transfersEnabled &&
    existing.detailsSubmitted === next.detailsSubmitted &&
    existing.onboardingComplete === next.onboardingComplete;
  if (unchanged) return { found: true, updated: false, account: existing } as const;

  const updated = await merchantModel.update({
    where: { id: existing.id },
    data: next,
  });
  return { found: true, updated: true, account: updated } as const;
}

export async function returnFromSellerStripeMerchantOnboarding({
  userId,
  db = getDb(),
  stripe,
}: {
  userId: string;
  db?: Db;
  stripe?: StripeDirectChargeMerchantClient;
}) {
  assertMerchantOnboardingEnabled();
  const company = await resolveSellerCompany({ db, userId });
  assertStripeConnectRuntimeConfiguration();
  const stripeClient = stripe ?? getStripe();
  const merchant = await findMerchantAccount(db, company.id);
  if (!merchant) {
    throw new StripeDirectChargeMerchantError(
      "Stripe payment account onboarding was not started.",
      404,
    );
  }

  const account = await stripeClient.accounts.retrieve(merchant.stripeAccountId);
  if ("deleted" in account && account.deleted) {
    throw new StripeDirectChargeMerchantError(
      "Stripe payment account is no longer available.",
      409,
    );
  }
  if (account.id !== merchant.stripeAccountId) {
    throw new StripeDirectChargeMerchantError(
      "Stripe payment account verification failed.",
      409,
    );
  }
  const synced = await syncSellerStripeMerchantAccount({ db, account });
  return safeAccount(synced.account ?? merchant);
}

export function isSellerStripeMerchantAccountStatus(
  value: string,
): value is SellerStripeMerchantAccountStatus {
  return [
    "ONBOARDING_INCOMPLETE",
    "UNDER_REVIEW",
    "ENABLED",
    "RESTRICTED",
    "DISABLED",
  ].includes(value as SellerStripeMerchantAccountStatus);
}
