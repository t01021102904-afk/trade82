import { getStripe } from "@/lib/stripe";
import { handleStripeConnectWebhookRequest } from "@/lib/stripe-connect-onboarding-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return Response.json({ error: "Stripe Connect webhook is unavailable." }, { status: 503 });
  }
  return handleStripeConnectWebhookRequest({
    payload: await request.text(),
    signature,
    webhookSecret: secret,
    stripe,
  });
}
