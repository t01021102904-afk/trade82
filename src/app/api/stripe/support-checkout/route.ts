import { apiError } from "@/lib/api-response";
import {
  enumField,
  rateLimitOrResponse,
  readJsonObject,
} from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import {
  isActiveSellerSupportSubscription,
  SELLER_SUPPORT_PLAN_IDS,
  SELLER_SUPPORT_PRODUCT_TYPE,
} from "@/lib/seller-support";
import { getDb } from "@/lib/db";
import {
  getAppUrl,
  getSellerSupportPriceId,
  getStripe,
} from "@/lib/stripe";
import { safeInternalPath } from "@/lib/url-security";

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Seller company profile is required before Seller Support." },
        { status: 403 },
      );
    }
    if (
      isActiveSellerSupportSubscription(
        company.sellerSupportStatus,
        company.sellerSupportPlan,
      )
    ) {
      return Response.json(
        { error: "Seller Support subscription is already active." },
        { status: 409 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "seller-support-checkout",
      userId: user.id,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const supportPlan = enumField(body, "supportPlan", SELLER_SUPPORT_PLAN_IDS);
    const successPath = safeInternalPath(
      typeof body.successPath === "string" ? body.successPath : "",
      "/dashboard/seller?section=support-team",
    );
    const cancelPath = safeInternalPath(
      typeof body.cancelPath === "string" ? body.cancelPath : "",
      "/pricing",
    );
    const appUrl = getAppUrl();
    const stripe = getStripe();
    const priceId = getSellerSupportPriceId(supportPlan);
    let customerId = company.sellerSupportStripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.tradeName || company.legalName || user.displayName,
        metadata: {
          userId: user.id,
          userProfileId: user.id,
          companyId: company.id,
          supportPlan,
          productType: SELLER_SUPPORT_PRODUCT_TYPE,
        },
      });
      customerId = customer.id;
      await getDb().company.update({
        where: { id: company.id },
        data: { sellerSupportStripeCustomerId: customerId },
      });
    }

    const metadata = {
      userId: user.id,
      userProfileId: user.id,
      companyId: company.id,
      supportPlan,
      productType: SELLER_SUPPORT_PRODUCT_TYPE,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}${cancelPath}`,
      metadata,
      subscription_data: { metadata },
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
