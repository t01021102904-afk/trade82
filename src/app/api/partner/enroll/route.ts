import { apiError } from "@/lib/api-response";
import { assertSameOrigin, rateLimitOrResponse } from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";
import { createOrGetPartnerProfile } from "@/lib/partner-referrals";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!isPartnerProgramEnabled()) {
      return Response.json({ error: "Partner program enrollment is not available." }, { status: 403 });
    }
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "partner-enrollment",
      userId: user.id,
      limit: 8,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const result = await createOrGetPartnerProfile(getDb(), user.id);
    return Response.json({
      partner: {
        referralCode: result.partnerProfile.referralCode,
        status: result.partnerProfile.status,
        createdAt: result.partnerProfile.createdAt,
      },
      created: result.created,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
