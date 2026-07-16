import "server-only";

import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { syncStripeConnectedAccount } from "@/lib/stripe-connect-onboarding";

/**
 * Sync only a previously recorded Connect account. This deliberately never
 * creates an account or performs any financial operation from a webhook.
 */
export async function processStripeConnectWebhookEvent(
  event: Stripe.Event,
  { db = getDb() }: { db?: ReturnType<typeof getDb> } = {},
) {
  if (event.type !== "account.updated") {
    return { handled: false, found: false, updated: false } as const;
  }

  const account = event.data.object;
  if (account.object !== "account" || ("deleted" in account && account.deleted)) {
    return { handled: true, found: false, updated: false } as const;
  }

  const synced = await syncStripeConnectedAccount({ db, account });
  return { handled: true, found: synced.found, updated: synced.updated } as const;
}
