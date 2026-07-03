import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { safeInternalPath } from "@/lib/url-security";

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company?.stripeCustomerId) {
      return Response.json(
        { error: "No Stripe customer is connected for this seller." },
        { status: 400 },
      );
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "billing-portal",
      userId: user.id,
      limit: 20,
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
    const session = await getStripe().billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${getAppUrl()}${settingsPath}?tab=billing`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return apiError(error);
  }
}
