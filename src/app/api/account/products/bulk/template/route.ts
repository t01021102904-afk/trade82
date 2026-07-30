import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { buildBulkProductTemplate } from "@/lib/bulk-product-registration";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json({ error: "Seller company required." }, { status: 403 });
    }
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-bulk-template",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const locale: Locale =
      new URL(request.url).searchParams.get("locale") === "ko" ? "ko" : "en";
    const workbook = await buildBulkProductTemplate(locale);
    const filename = `trade82-bulk-products-${locale}.xlsx`;

    return new Response(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(workbook.byteLength),
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
