import { apiError } from "@/lib/api-response";
import { canContactSeller, requireAuth, requireBuyer } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const inquiries = await getDb().inquiry.findMany({
      where: {
        OR: [
          { senderUserId: user.id },
          { recipientCompany: { ownerUserId: user.id } },
        ],
      },
      include: {
        buyerCompany: true,
        sellerCompany: true,
        product: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(inquiries);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, company: buyerCompany } = await requireBuyer();
    const body = (await request.json()) as Record<string, unknown>;
    const sellerCompanyId = String(body.sellerCompanyId ?? "");
    const sellerCompany = await getDb().company.findFirst({
      where: {
        id: sellerCompanyId,
        companyRole: "seller",
        verificationStatus: "verified",
      },
    });
    if (
      !buyerCompany ||
      !canContactSeller(user, buyerCompany) ||
      !sellerCompany
    ) {
      return Response.json(
        { error: "A buyer company and verified seller are required." },
        { status: 400 },
      );
    }
    const fullInquiry = buyerCompany.verificationStatus === "verified";

    const inquiry = await getDb().inquiry.create({
      data: {
        buyerCompanyId: buyerCompany.id,
        sellerCompanyId: sellerCompany.id,
        productId: typeof body.productId === "string" ? body.productId : null,
        senderUserId: user.id,
        recipientCompanyId: sellerCompany.id,
        message: String(body.message ?? ""),
        quantity:
          fullInquiry && typeof body.quantity === "string"
            ? body.quantity
            : null,
        targetDate:
          fullInquiry &&
          typeof body.targetDate === "string" &&
          body.targetDate
            ? new Date(body.targetDate)
            : null,
      },
    });
    return Response.json(inquiry, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
