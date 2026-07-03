import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { VERIFIED_SELLER_PLAN, isVerifiedSellerSubscription } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { getAppUrl, getStripe, getVerifiedSellerPriceId } from "@/lib/stripe";
import { safeInternalPath } from "@/lib/url-security";

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Seller company profile is required before billing." },
        { status: 403 },
      );
    }
    if (
      isVerifiedSellerSubscription(
        company.subscriptionStatus,
        company.subscriptionPlan,
      )
    ) {
      return Response.json(
        { error: "Verified Seller subscription is already active." },
        { status: 409 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "billing-checkout",
      userId: user.id,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = (await request.json().catch(() => null)) as
      | { returnPath?: unknown }
      | null;
    const returnPath = safeInternalPath(
      typeof body?.returnPath === "string" ? body.returnPath : "",
      "/dashboard/settings",
    );
    const settingsPath = returnPath.split("?")[0] || "/dashboard/settings";
    const appUrl = getAppUrl();
    const stripe = getStripe();
    const priceId = getVerifiedSellerPriceId();
    let customerId = company.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.tradeName || company.legalName || user.displayName,
        metadata: {
          userProfileId: user.id,
          companyId: company.id,
          plan: VERIFIED_SELLER_PLAN,
        },
      });
      customerId = customer.id;
      await getDb().company.update({
        where: { id: company.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${settingsPath}?tab=billing&checkout=success`,
      cancel_url: `${appUrl}${settingsPath}?tab=billing&checkout=cancelled`,
      metadata: {
        userProfileId: user.id,
        companyId: company.id,
        plan: VERIFIED_SELLER_PLAN,
      },
      subscription_data: {
        metadata: {
          userProfileId: user.id,
          companyId: company.id,
          plan: VERIFIED_SELLER_PLAN,
        },
      },
    });

    if (!session.url) {
      return Response.json(
        { error: "Stripe Checkout session URL was not created." },
        { status: 502 },
      );
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return apiError(error);
  }
}
