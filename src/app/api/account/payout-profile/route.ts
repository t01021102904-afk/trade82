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
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const manualPayoutMaintenanceMessage =
  "Payout information is temporarily unavailable. Please try again when manual payout maintenance is complete.";
const payoutProfileFields = new Set([
  "country",
  "bankDirectoryId",
  "bankName",
  "branchName",
  "accountHolder",
  "accountNumber",
  "accountType",
  "bankCode",
  "swiftBic",
  "bankAddress",
  "beneficiaryAddress",
  "payoutCurrency",
  "supportedCurrencies",
  "intermediaryBankName",
  "intermediaryBankSwift",
  "intermediaryBankAddress",
  "payoutMemo",
  "accountBelongsToCompany",
  "manualBankOverride",
  "manualOverrideReason",
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

function list(
  body: Record<string, unknown>,
  key: string,
  maxItems = 12,
  fallback: string[] = [],
) {
  const value = body[key];
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be a list of text values.`);
  }
  if (value.length > maxItems) throw new Error(`${key} has too many values.`);
  return value.map((item) => item.trim()).filter(Boolean);
}

function payoutInput(body: Record<string, unknown>): SellerPayoutProfileInput {
  rejectUnexpectedFields(body, payoutProfileFields);
  const accountType = text(body, "accountType", true, 30);
  if (!accountType || !["LOCAL", "FOREIGN_CURRENCY", "IBAN", "OTHER"].includes(accountType)) {
    throw new Error("accountType is invalid.");
  }
  if (typeof body.accountBelongsToCompany !== "boolean") {
    throw new Error("accountBelongsToCompany must be confirmed.");
  }
  if (typeof body.manualBankOverride !== "boolean") {
    throw new Error("manualBankOverride must be true or false.");
  }
  const country = text(body, "country", true, 2);
  if (!country || !/^[A-Za-z]{2}$/.test(country)) {
    throw new Error("country must be a two-letter ISO country code.");
  }
  const payoutCurrency = text(body, "payoutCurrency", true, 3);
  if (!payoutCurrency || !/^[A-Za-z]{3}$/.test(payoutCurrency)) {
    throw new Error("payoutCurrency must be a three-letter currency code.");
  }
  const accountNumber = text(body, "accountNumber", false, 64);
  const supportedCurrencies = list(body, "supportedCurrencies", 12, [payoutCurrency]);
  return {
    country: country.toUpperCase(),
    bankDirectoryId: text(body, "bankDirectoryId", false, 128),
    bankName: text(body, "bankName", true, 240) as string,
    branchName: text(body, "branchName", false, 240),
    accountHolder: text(body, "accountHolder", true, 240) as string,
    ...(accountNumber ? { accountNumber } : {}),
    accountType: accountType as SellerPayoutProfileInput["accountType"],
    bankCode: text(body, "bankCode", false, 80),
    swiftBic: text(body, "swiftBic", false, 80),
    bankAddress: text(body, "bankAddress", false, 600),
    beneficiaryAddress: text(body, "beneficiaryAddress", false, 600),
    payoutCurrency: payoutCurrency.toLowerCase(),
    supportedCurrencies,
    intermediaryBankName: text(body, "intermediaryBankName", false, 240),
    intermediaryBankSwift: text(body, "intermediaryBankSwift", false, 80),
    intermediaryBankAddress: text(body, "intermediaryBankAddress", false, 600),
    payoutMemo: text(body, "payoutMemo", false, 600),
    accountBelongsToCompany: body.accountBelongsToCompany,
    manualBankOverride: body.manualBankOverride,
    manualOverrideReason: text(body, "manualOverrideReason", false, 600),
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
    const profile = await saveSellerPayoutProfile({
      db: getDb(),
      companyId: company.id,
      input: payoutInput(await readJsonObject(request)),
    });
    return Response.json({ profile }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
