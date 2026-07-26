import { Prisma } from "@/generated/prisma/client";
import { listPublicHomepagePromotions } from "@/lib/homepage-promotions";

export async function GET(request: Request) {
  try {
    const locale =
      new URL(request.url).searchParams.get("locale") === "ko" ? "ko" : "en";
    const promotions = await listPublicHomepagePromotions(locale);
    return Response.json(promotions, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return Response.json([], {
        headers: { "Cache-Control": "public, max-age=0, s-maxage=15" },
      });
    }
    return Response.json(
      { error: "Homepage promotions are temporarily unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
