import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { safeInternalPath } from "@/lib/url-security";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "stripe-billing-portal",
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

    const company = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        companyRole: "seller",
      },
      select: {
        stripeCustomerId: true,
      },
    });
    const customerId = company?.stripeCustomerId ?? null;

    if (!customerId) {
      return Response.json(
        { error: "No billing account found yet." },
        { status: 400 },
      );
    }

    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${getAppUrl()}${settingsPath}`,
      });

      return Response.json({ url: session.url });
    } catch (error) {
      console.error("Stripe billing portal session failed.", {
        name: error instanceof Error ? error.name : typeof error,
      });
      return Response.json(
        { error: "Billing portal could not be opened right now." },
        { status: 502 },
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
