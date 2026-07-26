import { revalidatePath } from "next/cache";

import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  rateLimitOrResponse,
  readJsonObject,
  stringArrayField,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { HOMEPAGE_PROMOTION_MAX_ITEMS } from "@/lib/homepage-promotion-constants";
import { reorderHomepagePromotions } from "@/lib/homepage-promotions";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-homepage-promotions-order",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    const ids = stringArrayField(body, "ids", {
      maxItems: HOMEPAGE_PROMOTION_MAX_ITEMS,
      maxLength: 128,
    });
    if (!ids.length || ids.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) {
      throw new Response("Invalid promotion order.", { status: 400 });
    }
    const promotions = await reorderHomepagePromotions(ids);
    revalidatePath("/");
    revalidatePath("/ko");
    revalidatePath("/api/public/homepage-promotions");
    return Response.json(promotions);
  } catch (error) {
    return apiError(error);
  }
}
