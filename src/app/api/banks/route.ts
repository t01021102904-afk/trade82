import { apiError } from "@/lib/api-response";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireCurrentAppUser();
    const countryCode = new URL(request.url).searchParams.get("countryCode")?.trim().toUpperCase();
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      return Response.json({ error: "countryCode must be ISO 3166-1 alpha-2." }, { status: 400 });
    }
    const banks = await getDb().bankDirectory.findMany({
      where: { countryCode, isActive: true },
      orderBy: { bankNameEnglish: "asc" },
      select: {
        id: true,
        bankNameLocal: true,
        bankNameEnglish: true,
        bankCode: true,
        defaultSwiftBic: true,
        defaultBankAddress: true,
        officialWebsite: true,
        verifiedAt: true,
      },
    });
    return Response.json({ banks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
