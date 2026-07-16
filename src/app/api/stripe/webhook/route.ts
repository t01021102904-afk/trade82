import Stripe from "stripe";

import { VERIFIED_SELLER_PLAN, isVerifiedSellerSubscription } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { activateMarketingExposure } from "@/lib/marketing-exposure";
import {
  MARKETING_EXPOSURE_FEATURE,
  isMarketingExposurePlanId,
} from "@/lib/marketing-exposure-shared";
import {
  markPaymentRequestPaidFromCheckoutSession,
  markPaymentRequestPaidFromPaymentIntent,
  syncPaymentRequestDispute,
  syncPaymentRequestRefund,
} from "@/lib/payment-requests";
import { createSettlementLedgerAfterVerifiedPayment } from "@/lib/stripe-connect-settlement-webhook";
import {
  SELLER_SUPPORT_PRODUCT_TYPE,
  isActiveSellerSupportSubscription,
  isSellerSupportPlanId,
  sellerSupportMonthlyLimit,
} from "@/lib/seller-support";
import { getSellerSupportPlanForPriceId, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function idOf(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : null;
}

function dateFromUnix(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return dateFromUnix(subscription.items.data[0]?.current_period_end);
}

function nestedSubscriptionId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record.subscription === "string") return record.subscription;
  if (record.subscription && typeof record.subscription === "object") {
    const id = (record.subscription as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }

  return nestedSubscriptionId(record.subscription_details);
}

async function updateCompanyFromSubscription(subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer);
  const companyId = subscription.metadata.companyId;
  const priceId = subscription.items.data[0]?.price.id;
  const supportPlan =
    subscription.metadata.productType === SELLER_SUPPORT_PRODUCT_TYPE &&
    isSellerSupportPlanId(subscription.metadata.supportPlan)
      ? subscription.metadata.supportPlan
      : getSellerSupportPlanForPriceId(priceId);

  if (supportPlan) {
    const company = await getDb().company.findFirst({
      where: {
        companyRole: "seller",
        OR: [
          ...(companyId ? [{ id: companyId }] : []),
          { sellerSupportStripeSubscriptionId: subscription.id },
          ...(customerId ? [{ sellerSupportStripeCustomerId: customerId }] : []),
        ],
      },
      select: { id: true },
    });

    if (!company) {
      console.warn("Stripe support subscription webhook did not match a seller company.", {
        eventSubscriptionId: subscription.id,
        hasCustomerId: Boolean(customerId),
        hasCompanyId: Boolean(companyId),
      });
      return;
    }

    const supportActive = isActiveSellerSupportSubscription(
      subscription.status,
      supportPlan,
    );

    await getDb().company.update({
      where: { id: company.id },
      data: {
        sellerSupportStripeCustomerId: customerId,
        sellerSupportStripeSubscriptionId: subscription.id,
        sellerSupportStatus: subscription.status,
        sellerSupportPlan: supportPlan,
        sellerSupportCurrentPeriodEnd: subscriptionPeriodEnd(subscription),
        sellerSupportMonthlyLimit: supportActive
          ? sellerSupportMonthlyLimit(supportPlan)
          : 0,
        ...(supportActive ? {} : { sellerSupportMonthlyUsed: 0 }),
      },
    });
    return;
  }

  const configuredPriceId = process.env.STRIPE_VERIFIED_SELLER_PRICE_ID;
  const subscriptionPlan =
    subscription.metadata.plan === VERIFIED_SELLER_PLAN ||
    (configuredPriceId && priceId === configuredPriceId)
      ? VERIFIED_SELLER_PLAN
      : null;

  const company = await getDb().company.findFirst({
    where: {
      companyRole: "seller",
      OR: [
        ...(companyId ? [{ id: companyId }] : []),
        { stripeSubscriptionId: subscription.id },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true, verifiedSellerSince: true },
  });

  if (!company) {
    console.warn("Stripe subscription webhook did not match a seller company.", {
      eventSubscriptionId: subscription.id,
      hasCustomerId: Boolean(customerId),
      hasCompanyId: Boolean(companyId),
    });
    return;
  }

  const isActiveVerifiedSeller = isVerifiedSellerSubscription(
    subscription.status,
    subscriptionPlan,
  );

  await getDb().company.update({
    where: { id: company.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan,
      subscriptionCurrentPeriodEnd: subscriptionPeriodEnd(subscription),
      verifiedSellerSince:
        isActiveVerifiedSeller && !company.verifiedSellerSince
          ? new Date()
          : company.verifiedSellerSince,
    },
  });
}

async function updateFromSubscriptionId(subscriptionId: string | null) {
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await updateCompanyFromSubscription(subscription);
}

async function activateMarketingExposureFromSession(
  session: Stripe.Checkout.Session,
) {
  if (session.metadata?.feature !== MARKETING_EXPOSURE_FEATURE) return false;

  const productId = session.metadata.productId;
  const companyId = session.metadata.companyId;
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  const priceId = session.metadata.priceId;

  if (
    !productId ||
    !companyId ||
    !userId ||
    !isMarketingExposurePlanId(plan) ||
    !priceId
  ) {
    console.warn("Marketing exposure checkout session had incomplete metadata.", {
      sessionId: session.id,
      hasProductId: Boolean(productId),
      hasCompanyId: Boolean(companyId),
      hasUserId: Boolean(userId),
      hasPlan: Boolean(plan),
      hasPriceId: Boolean(priceId),
    });
    return true;
  }

  await activateMarketingExposure({
    checkoutSessionId: session.id,
    customerId: idOf(session.customer),
    paymentIntentId: idOf(session.payment_intent),
    productId,
    companyId,
    userId,
    planId: plan,
    priceId,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });

  return true;
}

async function recordSettlementLedgerAfterVerifiedPayment({
  paymentRequestId,
  stripeEventId,
  stripeEventType,
}: {
  paymentRequestId: string | null | undefined;
  stripeEventId: string;
  stripeEventType: string;
}) {
  if (!paymentRequestId) return;

  try {
    await createSettlementLedgerAfterVerifiedPayment(paymentRequestId);
  } catch (error) {
    console.error("Stripe Connect settlement ledger recording failed.", {
      paymentRequestId,
      stripeEventId,
      stripeEventType,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 500 },
    );
  }
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await request.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (await activateMarketingExposureFromSession(session)) {
          break;
        }
        if (
          await markPaymentRequestPaidFromCheckoutSession(session, {
            stripeEventId: event.id,
            stripeEventType: event.type,
          })
        ) {
          await recordSettlementLedgerAfterVerifiedPayment({
            paymentRequestId: session.metadata?.paymentRequestId,
            stripeEventId: event.id,
            stripeEventType: event.type,
          });
          break;
        }
        await updateFromSubscriptionId(idOf(session.subscription));
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentVerified = await markPaymentRequestPaidFromCheckoutSession(session, {
          stripeEventId: event.id,
          stripeEventType: event.type,
        });
        if (paymentVerified) {
          await recordSettlementLedgerAfterVerifiedPayment({
            paymentRequestId: session.metadata?.paymentRequestId,
            stripeEventId: event.id,
            stripeEventType: event.type,
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentVerified = await markPaymentRequestPaidFromPaymentIntent(paymentIntent, {
          stripeEventId: event.id,
          stripeEventType: event.type,
        });
        if (paymentVerified) {
          await recordSettlementLedgerAfterVerifiedPayment({
            paymentRequestId: paymentIntent.metadata.paymentRequestId,
            stripeEventId: event.id,
            stripeEventType: event.type,
          });
        }
        break;
      }
      case "refund.created":
      case "refund.updated": {
        await syncPaymentRequestRefund(event.data.object as Stripe.Refund, {
          stripeEventId: event.id,
          stripeEventType: event.type,
        });
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        await syncPaymentRequestDispute(event.data.object as Stripe.Dispute, {
          stripeEventId: event.id,
          stripeEventType: event.type,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await updateCompanyFromSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await updateFromSubscriptionId(nestedSubscriptionId(invoice.parent));
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing failed.", {
      eventType: event.type,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
