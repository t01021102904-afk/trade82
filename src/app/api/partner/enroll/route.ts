import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  enumField,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  stringField,
  validationErrorResponse,
  ApiValidationError,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { enrollPartnerProfile } from "@/lib/partner-enrollment";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";

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

    const body = await readJsonObject(request);
    rejectUnexpectedFields(
      body,
      new Set([
        "legalName",
        "displayName",
        "email",
        "phone",
        "country",
        "preferredLanguage",
        "organizationName",
        "websiteOrSocialUrl",
        "promotionDescription",
        "agreeToTerms",
        "acknowledgePrivacy",
      ]),
    );
    const agreeToTerms = body.agreeToTerms === true;
    const acknowledgePrivacy = body.acknowledgePrivacy === true;
    const result = await enrollPartnerProfile({
      userId: user.id,
      input: {
        legalName: requiredStringField(body, "legalName", 160),
        displayName: stringField(body, "displayName", { max: 120, fallback: null }),
        email: requiredStringField(body, "email", 320),
        phone: requiredStringField(body, "phone", 50),
        country: requiredStringField(body, "country", 100),
        preferredLanguage: enumField(body, "preferredLanguage", ["en", "ko"] as const),
        organizationName: stringField(body, "organizationName", { max: 160, fallback: null }),
        websiteOrSocialUrl: stringField(body, "websiteOrSocialUrl", { max: 500, fallback: null }),
        promotionDescription: stringField(body, "promotionDescription", { max: 1_500, fallback: null }),
        agreeToTerms,
        acknowledgePrivacy,
      },
    });
    return Response.json({
      partner: {
        referralCode: result.partnerProfile.referralCode,
        status: result.partnerProfile.status,
        createdAt: result.partnerProfile.createdAt,
      },
      created: result.created,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}
