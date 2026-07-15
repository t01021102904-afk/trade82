import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
} from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  saveSellerPayoutProfile,
  sellerPayoutProfileSafeSelect,
  type SellerPayoutProfileInput,
} from "@/lib/seller-payout-profiles";
import {
  findActiveKoreanSellerPayoutBank,
} from "@/lib/seller-payout-bank-directory";
import {
  assertKoreanPayoutConfiguration,
  normalizeKoreanAccountNumber,
} from "@/lib/seller-payout-profile-rules";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const manualPayoutMaintenanceMessage =
  "Payout information is temporarily unavailable. Please try again when manual payout maintenance is complete.";
const payoutProfileFields = new Set([
  "country",
  "bankDirectoryId",
  "accountHolder",
  "accountNumber",
  "accountType",
  "payoutCurrency",
  "supportedCurrencies",
  "accountBelongsToCompany",
  "termsAccepted",
  "privacyAccepted",
]);

function text(body: Record<string, unknown>, key: string, required = false, max = 500) {
  const value = body[key];
  if (value === undefined || value === null) {
    if (required) throw new Error(`${key} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${key} must be text.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${key} is too long.`);
  if (required && !result) throw new Error(`${key} is required.`);
  return result || null;
}

async function payoutInput(
  body: Record<string, unknown>,
  db: ReturnType<typeof getDb>,
): Promise<SellerPayoutProfileInput> {
  rejectUnexpectedFields(body, payoutProfileFields);
  if (body.accountBelongsToCompany !== true) {
    throw new Error("accountBelongsToCompany must be confirmed.");
  }
  if (body.termsAccepted !== true || body.privacyAccepted !== true) {
    throw new Error("Terms of Service and Privacy Policy acknowledgement are required.");
  }
  assertKoreanPayoutConfiguration({
    country: body.country,
    accountType: body.accountType,
    payoutCurrency: body.payoutCurrency,
    supportedCurrencies: body.supportedCurrencies,
  });
  const bankDirectoryId = text(body, "bankDirectoryId", true, 128) as string;
  const bank = await findActiveKoreanSellerPayoutBank(db, bankDirectoryId);
  if (!bank) throw new Error("Selected Korean bank is not available.");
  const rawAccountNumber = text(body, "accountNumber", false, 128);
  return {
    country: "KR",
    bankDirectoryId: bank.id,
    bankName: bank.bankNameEnglish,
    accountHolder: text(body, "accountHolder", true, 240) as string,
    ...(rawAccountNumber ? { accountNumber: normalizeKoreanAccountNumber(rawAccountNumber) } : {}),
    accountType: "LOCAL",
    payoutCurrency: "krw",
    supportedCurrencies: ["krw"],
    accountBelongsToCompany: true,
    manualBankOverride: false,
  };
}

export async function GET() {
  try {
    const { user, company } = await requireSeller();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: manualPayoutMaintenanceMessage }, { status: 503, headers: noStore });
    }
    if (!company) return Response.json({ profile: null, companyRequired: true }, { headers: noStore });
    const profile = await getDb().sellerPayoutProfile.findUnique({
      where: { companyId: company.id },
      select: sellerPayoutProfileSafeSelect,
    });
    return Response.json({ profile }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, company } = await requireSeller();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: manualPayoutMaintenanceMessage }, { status: 503, headers: noStore });
    }
    if (!company) return Response.json({ error: "Create a seller company before saving payout information." }, { status: 403, headers: noStore });
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-payout-profile-write",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
      message: "Too many payout profile updates. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;
    const db = getDb();
    const profile = await saveSellerPayoutProfile({
      db,
      companyId: company.id,
      input: await payoutInput(await readJsonObject(request), db),
    });
    return Response.json({ profile }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
