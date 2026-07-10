import { apiError } from "@/lib/api-response";
import {
  enumField,
  idField,
  rateLimitOrResponse,
  readJsonObject,
} from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  findSellerOwnedListedProduct,
  getMarketingExposurePriceId,
} from "@/lib/marketing-exposure";
import {
  MARKETING_EXPOSURE_FEATURE,
  MARKETING_EXPOSURE_PLACEMENT,
  MARKETING_EXPOSURE_PLAN_IDS,
  marketingExposurePlanById,
} from "@/lib/marketing-exposure-shared";
import { safeInternalPath } from "@/lib/url-security";

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Seller company profile is required before Marketing." },
        { status: 403 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "marketing-exposure-checkout",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const planId = enumField(body, "plan", MARKETING_EXPOSURE_PLAN_IDS);
    const productId = idField(body, "productId", { required: true });
    if (!productId) {
      return Response.json({ error: "Product is required." }, { status: 400 });
    }

    const product = await findSellerOwnedListedProduct({
      companyId: company.id,
      productId,
    });
    if (!product) {
      return Response.json(
        { error: "Only your own active listed products can be promoted." },
        { status: 403 },
      );
    }

    const plan = marketingExposurePlanById(planId);
    if (!plan) {
      return Response.json({ error: "Marketing plan is invalid." }, { status: 400 });
    }

    const successPath = safeInternalPath(
      typeof body.successPath === "string" ? body.successPath : "",
      "/dashboard/seller?section=marketing&marketing=success",
    );
    const cancelPath = safeInternalPath(
      typeof body.cancelPath === "string" ? body.cancelPath : "",
      "/dashboard/seller?section=marketing",
    );
    const appUrl = getAppUrl();
    const stripe = getStripe();
    const priceId = getMarketingExposurePriceId(planId);
    const metadata = {
      feature: MARKETING_EXPOSURE_FEATURE,
      placement: MARKETING_EXPOSURE_PLACEMENT,
      productId,
      companyId: company.id,
      userId: user.id,
      duration_days: String(plan.durationDays),
      plan: planId,
      priceId,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: company.stripeCustomerId ?? undefined,
      customer_email: company.stripeCustomerId ? undefined : user.email,
      customer_creation: company.stripeCustomerId ? undefined : "always",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}${cancelPath}`,
      metadata,
      payment_intent_data: { metadata },
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
