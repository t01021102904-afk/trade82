import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  enumField,
  idField,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  validationErrorResponse,
  ApiValidationError,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { enrollPartnerProfile } from "@/lib/partner-enrollment";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";
import { assertKoreanPayoutConfiguration } from "@/lib/seller-payout-profile-rules";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!isPartnerProgramEnabled()) {
      return Response.json({ error: "Partner program enrollment is not available." }, { status: 403, headers: noStore });
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
    rejectUnexpectedFields(body, new Set([
      "fullName",
      "phone",
      "preferredLanguage",
      "country",
      "bankDirectoryId",
      "accountHolder",
      "accountNumber",
      "accountType",
      "payoutCurrency",
      "supportedCurrencies",
      "accountBelongsToPartner",
      "agreeToTerms",
      "acknowledgePayoutTerms",
      "acknowledgePrivacy",
    ]));
    assertKoreanPayoutConfiguration({
      country: body.country,
      accountType: body.accountType,
      payoutCurrency: body.payoutCurrency,
      supportedCurrencies: body.supportedCurrencies,
    });
    const result = await enrollPartnerProfile({
      userId: user.id,
      email: user.email,
      input: {
        fullName: requiredStringField(body, "fullName", 160),
        phone: requiredStringField(body, "phone", 50),
        preferredLanguage: enumField(body, "preferredLanguage", ["en", "ko"] as const),
        bankDirectoryId: idField(body, "bankDirectoryId", { required: true }) as string,
        accountHolder: requiredStringField(body, "accountHolder", 240),
        accountNumber: requiredStringField(body, "accountNumber", 128),
        accountBelongsToPartner: body.accountBelongsToPartner === true,
        agreeToTerms: body.agreeToTerms === true,
        acknowledgePayoutTerms: body.acknowledgePayoutTerms === true,
        acknowledgePrivacy: body.acknowledgePrivacy === true,
      },
    });
    return Response.json({
      partner: {
        status: result.partnerProfile.status,
        createdAt: result.partnerProfile.createdAt,
        payoutProfile: result.payoutProfile,
      },
      created: result.created,
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof Error) return Response.json({ error: "Unable to submit partner enrollment." }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
