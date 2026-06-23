import { apiError } from "@/lib/api-response";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = checkRateLimit(`views:${forwarded}`, 120, 60_000);
    if (!rateLimit.allowed) {
      return Response.json({ counted: false }, { status: 429 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (body.type === "company") {
      const result = await getDb().company.updateMany({
        where: { id, verificationStatus: "verified" },
        data: { viewCount: { increment: 1 } },
      });
      return Response.json({ counted: result.count === 1 });
    }
    const result = await getDb().product.updateMany({
      where: {
        id,
        status: "active",
        sellerCompany: { verificationStatus: "verified" },
      },
      data: { viewCount: { increment: 1 } },
    });
    return Response.json({ counted: result.count === 1 });
  } catch (error) {
    return apiError(error);
  }
}
