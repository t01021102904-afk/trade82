import "server-only";

import Stripe from "stripe";
import { Prisma, type PrismaClient, type StripeConnectedAccount } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { isStripeConnectOnboardingEnabled } from "@/lib/stripe-connect-onboarding-feature";

export const stripeConnectOwnerTypes = ["seller", "partner"] as const;
export type StripeConnectOwnerType = (typeof stripeConnectOwnerTypes)[number];

type Db = PrismaClient;
type TransactionDb = Prisma.TransactionClient;
type StripeConnectClient = Pick<Stripe, "accounts" | "accountLinks">;

type OnboardingOwner = {
  type: StripeConnectOwnerType;
  id: string;
  country: string;
};

export type StripeConnectedAccountState = Pick<
  StripeConnectedAccount,
  | "status"
  | "chargesEnabled"
  | "payoutsEnabled"
  | "transfersEnabled"
  | "detailsSubmitted"
  | "onboardingComplete"
>;

export type SafeStripeConnectedAccount = StripeConnectedAccountState & {
  exists: boolean;
};

export class StripeConnectOnboardingError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "StripeConnectOnboardingError";
  }
}

// These are the countries Trade82 currently permits for its Stripe-hosted
// Connect flow. Keep eligibility in one place so routes cannot drift.
const stripeConnectOnboardingCountries = new Set([
  "AL", "AM", "AU", "AT", "BS", "BH", "BE", "BJ", "BO", "BA", "BW", "BN",
  "BG", "KH", "CA", "CL", "CO", "CR", "CI", "CY", "CZ", "DK", "DO", "EC",
  "EG", "SV", "EE", "ET", "FI", "FR", "GM", "DE", "GH", "GR", "GT", "GY",
  "HK", "HU", "IS", "IE", "IL", "IT", "JM", "JP", "JO", "KE", "KW", "LV",
  "LT", "LU", "MO", "MG", "MT", "MU", "MX", "MD", "MC", "MN", "MA", "NA",
  "NL", "NZ", "NG", "MK", "NO", "OM", "PK", "PA", "PY", "PE", "PH", "PL",
  "PT", "QA", "RO", "RW", "SA", "SN", "RS", "SG", "SK", "SI", "ZA", "KR",
  "ES", "LK", "LC", "SE", "CH", "TW", "TZ", "TH", "TT", "TN", "TR", "AE",
  "GB", "US", "UY", "UZ", "VN",
]);

const countryAliases: Record<string, string> = {
  "south korea": "KR",
  "republic of korea": "KR",
  "korea, republic of": "KR",
  korea: "KR",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
};

export function isStripeConnectOwnerType(value: string): value is StripeConnectOwnerType {
  return stripeConnectOwnerTypes.includes(value as StripeConnectOwnerType);
}

export function normalizeStripeConnectCountry(country: string | null | undefined) {
  const raw = country?.trim();
  if (!raw) return null;

  const normalized = raw.length === 2 ? raw.toUpperCase() : countryAliases[raw.toLowerCase()];
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

export function assertStripeConnectCountry(country: string | null | undefined) {
  const normalized = normalizeStripeConnectCountry(country);
  if (!normalized) {
    throw new StripeConnectOnboardingError(
      "A valid account country is required before Stripe onboarding can begin.",
      400,
    );
  }
  if (!stripeConnectOnboardingCountries.has(normalized)) {
    throw new StripeConnectOnboardingError(
      "Stripe onboarding is not configured for this country.",
      400,
    );
  }
  return normalized;
}

export function stripeConnectOwnerIdempotencyKey(owner: OnboardingOwner) {
  return `trade82-connect-onboarding:${owner.type}:${owner.id}`;
}

export function mapStripeConnectedAccount(account: Pick<
  Stripe.Account,
  | "charges_enabled"
  | "payouts_enabled"
  | "details_submitted"
  | "capabilities"
  | "requirements"
>) : StripeConnectedAccountState {
  const requirements = account.requirements;
  const hasOpenRequirements = Boolean(
    requirements?.currently_due?.length ||
      requirements?.past_due?.length ||
      requirements?.pending_verification?.length,
  );
  const disabled = Boolean(requirements?.disabled_reason);
  const detailsSubmitted = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const transfersEnabled = account.capabilities?.transfers === "active";
  const onboardingComplete =
    !disabled &&
    !hasOpenRequirements &&
    detailsSubmitted &&
    payoutsEnabled &&
    transfersEnabled;

  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled,
    transfersEnabled,
    detailsSubmitted,
    onboardingComplete,
    status: disabled
      ? "DISABLED"
      : !detailsSubmitted
        ? "PENDING"
        : onboardingComplete
          ? "ENABLED"
          : "RESTRICTED",
  };
}

function safeState(account: StripeConnectedAccount | null): SafeStripeConnectedAccount {
  if (!account) {
    return {
      exists: false,
      status: "PENDING",
      chargesEnabled: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    };
  }

  return {
    exists: true,
    status: account.status,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    transfersEnabled: account.transfersEnabled,
    detailsSubmitted: account.detailsSubmitted,
    onboardingComplete: account.onboardingComplete,
  };
}

function accountWhere(owner: OnboardingOwner) {
  return owner.type === "seller"
    ? { companyId: owner.id }
    : { partnerProfileId: owner.id };
}

async function resolveOwner({
  db,
  userId,
  ownerType,
}: {
  db: Db;
  userId: string;
  ownerType: StripeConnectOwnerType;
}): Promise<OnboardingOwner> {
  if (ownerType === "seller") {
    const company = await db.company.findFirst({
      where: { ownerUserId: userId, companyRole: "seller" },
      select: { id: true, country: true },
    });
    if (!company) {
      throw new StripeConnectOnboardingError(
        "Only the owner of a seller company can set up a Stripe payout account.",
        403,
      );
    }
    return { type: ownerType, id: company.id, country: assertStripeConnectCountry(company.country) };
  }

  const partner = await db.partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true, user: { select: { country: true } } },
  });
  if (!partner || partner.status !== "ACTIVE") {
    throw new StripeConnectOnboardingError(
      "Only the owner of an active partner profile can set up a Stripe payout account.",
      403,
    );
  }
  return {
    type: ownerType,
    id: partner.id,
    country: assertStripeConnectCountry(partner.user.country),
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function createConnectedAccount(
  stripe: StripeConnectClient,
  owner: OnboardingOwner,
) {
  return stripe.accounts.create(
    {
      country: owner.country,
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "express" },
      },
      capabilities: { transfers: { requested: true } },
      metadata: {
        trade82_owner_type: owner.type,
        trade82_owner_id: owner.id,
      },
    },
    { idempotencyKey: stripeConnectOwnerIdempotencyKey(owner) },
  );
}

async function findOwnerAccount(db: Pick<Db, "stripeConnectedAccount">, owner: OnboardingOwner) {
  return db.stripeConnectedAccount.findUnique({ where: accountWhere(owner) });
}

async function withOwnerLock<T>(
  db: Db,
  owner: OnboardingOwner,
  work: (tx: TransactionDb) => Promise<T>,
) {
  const lockKey = `trade82-connect-onboarding:${owner.type}:${owner.id}`;
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      return work(tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function createOrReuseConnectedAccount({
  db,
  stripe,
  owner,
}: {
  db: Db;
  stripe: StripeConnectClient;
  owner: OnboardingOwner;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withOwnerLock(db, owner, async (tx) => {
        const existing = await findOwnerAccount(tx, owner);
        if (existing) return existing;

        const stripeAccount = await createConnectedAccount(stripe, owner);
        return tx.stripeConnectedAccount.create({
          data: {
            ...(owner.type === "seller"
              ? { companyId: owner.id }
              : { partnerProfileId: owner.id }),
            stripeAccountId: stripeAccount.id,
            ...mapStripeConnectedAccount(stripeAccount),
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await findOwnerAccount(db, owner);
        if (existing) return existing;
      }
      if (isSerializationConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Unable to create Stripe connected account.");
}

function onboardingBaseUrl() {
  const appUrl = new URL(getAppUrl());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname);
  if (!local && appUrl.protocol !== "https:") {
    throw new StripeConnectOnboardingError(
      "Stripe onboarding requires an HTTPS application URL.",
      503,
    );
  }
  return appUrl.origin;
}

function onboardingUrls(ownerType: StripeConnectOwnerType) {
  const baseUrl = onboardingBaseUrl();
  const path = `/api/stripe/connect/onboarding/${ownerType}`;
  return {
    refreshUrl: `${baseUrl}${path}/refresh`,
    returnUrl: `${baseUrl}${path}/return`,
  };
}

async function createOnboardingLink(
  stripe: StripeConnectClient,
  ownerType: StripeConnectOwnerType,
  stripeAccountId: string,
) {
  const { refreshUrl, returnUrl } = onboardingUrls(ownerType);
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
}

function assertOnboardingEnabled() {
  if (!isStripeConnectOnboardingEnabled()) {
    throw new StripeConnectOnboardingError("Stripe payout onboarding is not available.", 403);
  }
}

export async function getStripeConnectOnboardingStatus({
  userId,
  ownerType,
  db = getDb(),
}: {
  userId: string;
  ownerType: StripeConnectOwnerType;
  db?: Db;
}) {
  const owner = await resolveOwner({ db, userId, ownerType });
  return safeState(await findOwnerAccount(db, owner));
}

export async function startStripeConnectOnboarding({
  userId,
  ownerType,
  db = getDb(),
  stripe,
}: {
  userId: string;
  ownerType: StripeConnectOwnerType;
  db?: Db;
  stripe?: StripeConnectClient;
}) {
  assertOnboardingEnabled();
  const stripeClient = stripe ?? getStripe();
  const owner = await resolveOwner({ db, userId, ownerType });
  const connectedAccount = await createOrReuseConnectedAccount({ db, stripe: stripeClient, owner });
  const link = await createOnboardingLink(stripeClient, owner.type, connectedAccount.stripeAccountId);

  return { url: link.url, account: safeState(connectedAccount) };
}

export async function refreshStripeConnectOnboarding({
  userId,
  ownerType,
  db = getDb(),
  stripe,
}: {
  userId: string;
  ownerType: StripeConnectOwnerType;
  db?: Db;
  stripe?: StripeConnectClient;
}) {
  return startStripeConnectOnboarding({ userId, ownerType, db, stripe });
}

export async function syncStripeConnectedAccount({
  db = getDb(),
  account,
}: {
  db?: Db;
  account: Stripe.Account;
}) {
  const existing = await db.stripeConnectedAccount.findUnique({
    where: { stripeAccountId: account.id },
  });
  if (!existing) return { found: false, updated: false, account: null } as const;

  const next = mapStripeConnectedAccount(account);
  const unchanged =
    existing.status === next.status &&
    existing.chargesEnabled === next.chargesEnabled &&
    existing.payoutsEnabled === next.payoutsEnabled &&
    existing.transfersEnabled === next.transfersEnabled &&
    existing.detailsSubmitted === next.detailsSubmitted &&
    existing.onboardingComplete === next.onboardingComplete;
  if (unchanged) return { found: true, updated: false, account: existing } as const;

  const updated = await db.stripeConnectedAccount.update({
    where: { id: existing.id },
    data: next,
  });
  return { found: true, updated: true, account: updated } as const;
}

export async function returnFromStripeConnectOnboarding({
  userId,
  ownerType,
  db = getDb(),
  stripe,
}: {
  userId: string;
  ownerType: StripeConnectOwnerType;
  db?: Db;
  stripe?: StripeConnectClient;
}) {
  assertOnboardingEnabled();
  const stripeClient = stripe ?? getStripe();
  const owner = await resolveOwner({ db, userId, ownerType });
  const connectedAccount = await findOwnerAccount(db, owner);
  if (!connectedAccount) {
    throw new StripeConnectOnboardingError("Stripe payout onboarding was not started.", 404);
  }
  const account = await stripeClient.accounts.retrieve(connectedAccount.stripeAccountId);
  if ("deleted" in account && account.deleted) {
    throw new StripeConnectOnboardingError("Stripe payout account is no longer available.", 409);
  }
  if (account.id !== connectedAccount.stripeAccountId) {
    throw new StripeConnectOnboardingError("Stripe payout account verification failed.", 409);
  }
  const synced = await syncStripeConnectedAccount({ db, account });
  return safeState(synced.account ?? connectedAccount);
}
