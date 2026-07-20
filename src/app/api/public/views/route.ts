import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  readJsonObject,
  requiredIdField,
  validationErrorResponse,
} from "@/lib/api-security";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimit = checkRateLimit(`views:${forwarded}`, 120, 60_000);
    if (!rateLimit.allowed) {
      return Response.json({ counted: false }, { status: 429 });
    }
    const body = await readJsonObject(request);
    const id = requiredIdField(body, "id");
    const type = enumField(body, "type", ["company", "product"] as const);
    if (type === "company") {
      const result = await getDb().company.updateMany({
        where: { id, verificationStatus: "verified", deletedAt: null },
        data: { viewCount: { increment: 1 } },
      });
      return Response.json({ counted: result.count === 1 });
    }
    const result = await getDb().product.updateMany({
      where: {
        id,
        status: "active",
        deletedAt: null,
        sellerCompany: { verificationStatus: "verified", deletedAt: null },
      },
      data: { viewCount: { increment: 1 } },
    });
    return Response.json({ counted: result.count === 1 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
