import { apiError } from "@/lib/api-response";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";
import { isTradeOrderSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    if (!isTradeOrderSystemEnabledForClerkUser(user.clerkUserId)) {
      return Response.json({ error: "Orders are not enabled for this account." }, { status: 403 });
    }
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "24") || 24));
    const companies = await getDb().company.findMany({
      where: { ownerUserId: user.id, deletedAt: null },
      select: { id: true, companyRole: true },
    });
    const buyerCompanyIds = companies.filter((company) => company.companyRole === "buyer").map((company) => company.id);
    const sellerCompanyIds = companies.filter((company) => company.companyRole === "seller").map((company) => company.id);
    const where = { OR: [{ buyerCompanyId: { in: buyerCompanyIds } }, { sellerCompanyId: { in: sellerCompanyIds } }] };
    const [total, orders] = await Promise.all([
      getDb().tradeOrder.count({ where }),
      getDb().tradeOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          orderNumber: true,
          buyerCompanyId: true,
          sellerCompanyId: true,
          orderStatus: true,
          paymentStatus: true,
          shipmentStatus: true,
          payoutStatus: true,
          grossAmount: true,
          platformFeeAmount: true,
          sellerPayableAmount: true,
          currency: true,
          createdAt: true,
          items: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { productName: true, quantity: true, unit: true },
          },
          shipment: { select: { trackingNumber: true, shipmentStatus: true } },
        },
      }),
    ]);
    const sellerCompanyIdSet = new Set(sellerCompanyIds);
    const safeOrders = orders.map((order) => {
      const safeOrder: Record<string, unknown> = { ...order };
      const sellerCompanyId = order.sellerCompanyId;
      delete safeOrder.buyerCompanyId;
      delete safeOrder.sellerCompanyId;
      // A buyer can see its order totals and shipping progress, but never the
      // seller's payout amount or payout/bank state. Seller-owned rows retain
      // their own payout summary without exposing beneficiary instructions.
      if (!sellerCompanyIdSet.has(sellerCompanyId)) {
        delete safeOrder.payoutStatus;
        delete safeOrder.platformFeeAmount;
        delete safeOrder.sellerPayableAmount;
      }
      return safeOrder;
    });
    return Response.json({ orders: safeOrders, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
