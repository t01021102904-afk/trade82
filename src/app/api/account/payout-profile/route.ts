import { apiError } from "@/lib/api-response";
import { readJsonObject } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  saveSellerPayoutProfile,
  sellerPayoutProfileSafeSelect,
  type SellerPayoutProfileInput,
} from "@/lib/seller-payout-profiles";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

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

function list(body: Record<string, unknown>, key: string, maxItems = 12) {
  const value = body[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be a list of text values.`);
  }
  if (value.length > maxItems) throw new Error(`${key} has too many values.`);
  return value.map((item) => item.trim()).filter(Boolean);
}

function payoutInput(body: Record<string, unknown>): SellerPayoutProfileInput {
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
  const accountNumber = text(body, "accountNumber", false, 120);
  return {
    country: text(body, "country", true, 120) as string,
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
    payoutCurrency: text(body, "payoutCurrency", true, 3) as string,
    supportedCurrencies: list(body, "supportedCurrencies"),
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
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
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
    const { user, company } = await requireSeller();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    if (!company) return Response.json({ error: "Create a seller company before saving payout information." }, { status: 403, headers: noStore });
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
