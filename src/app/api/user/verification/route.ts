import { apiError } from "@/lib/api-response";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Create your Korean seller company first." },
        { status: 400 },
      );
    }

    await getDb().$transaction([
      getDb().company.update({
        where: { id: company.id },
        data: { verificationStatus: "pending_review" },
      }),
      getDb().verificationRequest.create({
        data: {
          companyId: company.id,
          requestedByUserId: user.id,
          status: "pending_review",
        },
      }),
    ]);

    return Response.json({ ok: true, verificationStatus: "pending_review" });
  } catch (error) {
    return apiError(error);
  }
}
