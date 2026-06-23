import { apiError } from "@/lib/api-response";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const deals = await getDb().deal.findMany({
      where: {
        OR: [
          { buyerCompany: { ownerUserId: user.id } },
          { sellerCompany: { ownerUserId: user.id } },
        ],
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        reviews: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(
      deals.map((deal) => ({
        ...deal,
        contractFilePath: undefined,
        hasContractFile: Boolean(deal.contractFilePath),
        contractValue: deal.contractValue.toString(),
        reviews: deal.reviews.map((review) => ({
          ...review,
          contractValue: review.contractValue.toString(),
        })),
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json()) as Record<string, unknown>;
    const buyerCompanyId = String(body.buyerCompanyId ?? "");
    const sellerCompanyId = String(body.sellerCompanyId ?? "");
    const participant = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        id: { in: [buyerCompanyId, sellerCompanyId] },
      },
    });
    if (!participant) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const deal = await getDb().deal.create({
      data: {
        inquiryId: typeof body.inquiryId === "string" ? body.inquiryId : null,
        buyerCompanyId,
        sellerCompanyId,
        productId: typeof body.productId === "string" ? body.productId : null,
        contractTitle: String(body.contractTitle ?? ""),
        contractValue: String(body.contractValue ?? "0"),
        currency: String(body.currency ?? "USD"),
        dealStatus: body.dealStatus === "completed" ? "completed" : "proposed",
        completedAt: body.dealStatus === "completed" ? new Date() : null,
        createdByUserId: user.id,
        confirmedByBuyer: participant.companyRole === "buyer",
        confirmedBySeller: participant.companyRole === "seller",
        isPublic: body.isPublic === true,
        publicValueDisplay:
          body.publicValueDisplay === "exact" ||
          body.publicValueDisplay === "range"
            ? body.publicValueDisplay
            : "hidden",
      },
    });
    return Response.json(
      {
        ...deal,
        contractFilePath: undefined,
        hasContractFile: Boolean(deal.contractFilePath),
        contractValue: deal.contractValue.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
