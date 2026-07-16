import { getStripe } from "@/lib/stripe";
import { processStripeConnectWebhookEvent } from "@/lib/stripe-connect-onboarding-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return Response.json({ error: "Stripe Connect webhook is unavailable." }, { status: 503 });
  }

  try {
    const payload = await request.text();
    const event = getStripe().webhooks.constructEvent(payload, signature, secret);
    await processStripeConnectWebhookEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof Error && error.name === "StripeSignatureVerificationError") {
      return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
    }
    console.error("Stripe Connect webhook processing failed.", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return Response.json({ error: "Stripe Connect webhook could not be processed." }, { status: 500 });
  }
}
