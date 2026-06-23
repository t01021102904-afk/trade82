import { apiError } from "@/lib/api-response";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const { id } = await params;
    const inquiry = await getDb().inquiry.findFirst({
      where: {
        id,
        OR: [
          { senderUserId: user.id },
          { recipientCompany: { ownerUserId: user.id } },
        ],
      },
    });
    if (!inquiry) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const body = (await request.json()) as { body?: unknown };
    const senderCompany = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        id: { in: [inquiry.buyerCompanyId, inquiry.sellerCompanyId] },
      },
    });
    const receiverCompanyId =
      senderCompany?.id === inquiry.buyerCompanyId
        ? inquiry.sellerCompanyId
        : inquiry.buyerCompanyId;
    const message = await getDb().message.create({
      data: {
        inquiryId: inquiry.id,
        senderUserId: user.id,
        senderCompanyId: senderCompany?.id,
        receiverCompanyId,
        body: String(body.body ?? ""),
      },
    });
    await getDb().inquiry.update({
      where: { id },
      data: { status: "replied" },
    });
    return Response.json(message, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
