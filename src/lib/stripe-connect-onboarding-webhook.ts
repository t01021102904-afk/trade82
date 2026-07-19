import "server-only";

import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { syncStripeConnectedAccount } from "@/lib/stripe-connect-onboarding";
import { syncSellerStripeMerchantAccount } from "@/lib/stripe-direct-charge-merchant";
import {
  assertStripeConnectRuntimeConfiguration,
  isStripeConnectRuntimeConfigurationError,
  stripeEventMatchesConfiguredRuntime,
} from "@/lib/stripe-connect-runtime-mode";

type StripeWebhookClient = Pick<Stripe, "webhooks">;

type StripeConnectWebhookLog = (entry: {
  stripeEventId: string;
  stripeEventType: string;
  eventLivemode: boolean;
  configuredRuntimeMode: "live" | "test";
  reason: "stripe_connect_runtime_mismatch";
}) => void;

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
  const merchantSynced = await syncSellerStripeMerchantAccount({ db, account });
  return {
    handled: true,
    found: synced.found || merchantSynced.found,
    updated: synced.updated || merchantSynced.updated,
  } as const;
}

export async function handleStripeConnectWebhookRequest({
  payload,
  signature,
  webhookSecret,
  stripe,
  processEvent = processStripeConnectWebhookEvent,
  logRuntimeMismatch = (entry) => console.warn("Stripe Connect webhook ignored.", entry),
}: {
  payload: string;
  signature: string | null;
  webhookSecret: string | undefined;
  stripe: StripeWebhookClient;
  processEvent?: typeof processStripeConnectWebhookEvent;
  logRuntimeMismatch?: StripeConnectWebhookLog;
}) {
  if (!signature || !webhookSecret) {
    return Response.json({ error: "Stripe Connect webhook is unavailable." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    if (error instanceof Error && error.name === "StripeSignatureVerificationError") {
      return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
    }
    return Response.json({ error: "Stripe Connect webhook could not be processed." }, { status: 500 });
  }

  try {
    const runtimeMode = assertStripeConnectRuntimeConfiguration();
    if (!stripeEventMatchesConfiguredRuntime(event, runtimeMode)) {
      logRuntimeMismatch({
        stripeEventId: event.id,
        stripeEventType: event.type,
        eventLivemode: event.livemode,
        configuredRuntimeMode: runtimeMode,
        reason: "stripe_connect_runtime_mismatch",
      });
      return Response.json({ received: true, handled: false });
    }

    const result = await processEvent(event);
    return Response.json({ received: true, handled: result.handled });
  } catch (error) {
    if (isStripeConnectRuntimeConfigurationError(error)) {
      return Response.json({ error: "Stripe Connect webhook is unavailable." }, { status: 503 });
    }
    console.error("Stripe Connect webhook processing failed.", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return Response.json({ error: "Stripe Connect webhook could not be processed." }, { status: 500 });
  }
}
