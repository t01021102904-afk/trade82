import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const paymentRequests = await getDb().paymentRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        buyerCompany: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            owner: { select: { email: true, displayName: true } },
          },
        },
        sellerCompany: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            owner: { select: { email: true, displayName: true } },
          },
        },
        disputes: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { status: true, reason: true, amount: true, updatedAt: true },
        },
        releasedByUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    return Response.json(paymentRequests);
  } catch (error) {
    return apiError(error);
  }
}
