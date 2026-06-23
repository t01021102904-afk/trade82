import { apiError } from "@/lib/api-response";
import { isAdminUser, requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createSignedPrivateFileUrl } from "@/lib/supabase-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    const user = await requireAuth();
    const { dealId } = await params;
    const deal = await getDb().deal.findUnique({ where: { id: dealId } });
    if (!deal?.contractFilePath) {
      return Response.json({ error: "Contract file not found" }, { status: 404 });
    }
    const participant = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        id: { in: [deal.buyerCompanyId, deal.sellerCompanyId] },
      },
      select: { id: true },
    });
    if (!participant && !(await isAdminUser())) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.json({
      signedUrl: await createSignedPrivateFileUrl(deal.contractFilePath),
      filename: deal.contractFileName,
      expiresIn: 300,
    });
  } catch (error) {
    return apiError(error);
  }
}
