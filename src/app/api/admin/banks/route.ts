import { apiError } from "@/lib/api-response";
import { readJsonObject } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isSafeOfficialBankWebsite } from "@/lib/bank-directory-security";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function value(body: Record<string, unknown>, key: string, required = false, max = 500) {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    if (required) throw new Error(`${key} is required.`);
    return null;
  }
  if (typeof raw !== "string") throw new Error(`${key} must be text.`);
  const result = raw.trim();
  if (result.length > max) throw new Error(`${key} is too long.`);
  if (required && !result) throw new Error(`${key} is required.`);
  return result || null;
}

function httpUrl(value: string | null, key: string) {
  if (!value) return null;
  if (!isSafeOfficialBankWebsite(value)) {
    throw new Error(`${key} must be an HTTPS URL.`);
  }
  return new URL(value).toString();
}

function bankData(body: Record<string, unknown>, forCreate: boolean) {
  const countryCode = value(body, "countryCode", true, 2)?.toUpperCase();
  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) throw new Error("countryCode must be ISO 3166-1 alpha-2.");
  return {
    countryCode,
    bankNameLocal: value(body, "bankNameLocal", true, 240) as string,
    bankNameEnglish: value(body, "bankNameEnglish", true, 240) as string,
    bankCode: value(body, "bankCode", false, 80),
    defaultSwiftBic: value(body, "defaultSwiftBic", false, 80),
    defaultBankAddress: value(body, "defaultBankAddress", false, 600),
    officialWebsite: httpUrl(value(body, "officialWebsite", false, 500), "officialWebsite"),
    sourceUrl: httpUrl(value(body, "sourceUrl", false, 500), "sourceUrl"),
    isActive: typeof body.isActive === "boolean" ? body.isActive : forCreate ? true : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const url = new URL(request.url);
    const countryCode = url.searchParams.get("countryCode")?.trim().toUpperCase();
    const search = url.searchParams.get("search")?.trim();
    const banks = await getDb().bankDirectory.findMany({
      where: {
        ...(countryCode ? { countryCode } : {}),
        ...(search
          ? {
              OR: [
                { bankNameEnglish: { contains: search, mode: "insensitive" } },
                { bankNameLocal: { contains: search, mode: "insensitive" } },
                { defaultSwiftBic: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ countryCode: "asc" }, { bankNameEnglish: "asc" }],
      take: 500,
    });
    return Response.json({ banks }, { headers: noStore });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    const input = bankData(body, true);
    if (body.verifiedAt === true && (!input.sourceUrl || !input.officialWebsite)) {
      throw new Error("An official website and official source URL are required before marking a bank verified.");
    }
    const bank = await getDb().bankDirectory.create({
      data: {
        ...input,
        sourceType: "ADMIN",
        verifiedAt: body.verifiedAt === true ? new Date() : null,
      },
    });
    return Response.json({ bank }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    }
    const body = await readJsonObject(request);
    const id = value(body, "id", true, 128) as string;
    const input = bankData(body, false);
    if (body.verifiedAt === true && (!input.sourceUrl || !input.officialWebsite)) {
      throw new Error("An official website and official source URL are required before marking a bank verified.");
    }
    const bank = await getDb().bankDirectory.update({
      where: { id },
      data: {
        ...input,
        sourceType: "ADMIN_OVERRIDE",
        ...(body.verifiedAt === true ? { verifiedAt: new Date() } : body.verifiedAt === false ? { verifiedAt: null } : {}),
      },
    });
    return Response.json({ bank }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    return apiError(error);
  }
}
