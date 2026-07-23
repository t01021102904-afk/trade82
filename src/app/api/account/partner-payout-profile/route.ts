import { apiError } from "@/lib/api-response";
import { PartnerProfileStatus } from "@/generated/prisma/client";
import {
  assertSameOrigin,
  idField,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
  validationErrorResponse,
  ApiValidationError,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  authorizePartnerPayoutWrite,
  lockOwnedPartnerProfile,
} from "@/lib/partner-profile-locks";
import {
  partnerPayoutProfileOwnerSelect,
  savePartnerPayoutProfile,
} from "@/lib/partner-payout-profiles";
import { assertKoreanPayoutConfiguration } from "@/lib/seller-payout-profile-rules";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const fields = new Set([
  "country",
  "bankDirectoryId",
  "accountHolder",
  "accountNumber",
  "accountType",
  "payoutCurrency",
  "supportedCurrencies",
  "accountBelongsToPartner",
]);

async function getOwnedPartner(userId: string) {
  return getDb().partnerProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, status: true },
  });
}

export async function GET() {
  try {
    const user = await requireAuth();
    const partner = await getOwnedPartner(user.id);
    if (!partner) return Response.json({ profile: null, partnerRequired: true }, { headers: noStore });
    if (partner.status === PartnerProfileStatus.REJECTED) {
      return Response.json({ profile: null, partnerStatus: partner.status }, { headers: noStore });
    }
    const profile = await getDb().partnerPayoutProfile.findUnique({
      where: { partnerProfileId: partner.id },
      select: partnerPayoutProfileOwnerSelect,
    });
    return Response.json({ profile, partnerStatus: partner.status }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "partner-payout-profile-write",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, fields);
    assertKoreanPayoutConfiguration({
      country: body.country,
      accountType: body.accountType,
      payoutCurrency: body.payoutCurrency,
      supportedCurrencies: body.supportedCurrencies,
    });
    const result = await getDb().$transaction(async (tx) => {
      const authorization = authorizePartnerPayoutWrite(
        await lockOwnedPartnerProfile(tx, user.id),
      );
      if (!authorization.ok) return authorization;

      const profile = await savePartnerPayoutProfile({
        db: tx,
        partnerProfileId: authorization.partnerProfileId,
        actorUserId: user.id,
        input: {
          bankDirectoryId: idField(body, "bankDirectoryId", { required: true }) as string,
          accountHolder: requiredStringField(body, "accountHolder", 240),
          accountNumber: requiredStringField(body, "accountNumber", 128),
          accountBelongsToPartner: body.accountBelongsToPartner === true,
        },
      });
      return { ok: true as const, profile };
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status, headers: noStore });
    }
    return Response.json({ profile: result.profile }, { headers: noStore });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof Error) return Response.json({ error: "Unable to update payout information." }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
