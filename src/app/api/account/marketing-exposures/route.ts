import { apiError } from "@/lib/api-response";
import { requireSeller } from "@/lib/authz";
import { listSellerMarketingExposures } from "@/lib/marketing-exposure";

export async function GET() {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json(
        { error: "Seller company profile is required before Marketing." },
        { status: 403 },
      );
    }

    const exposures = await listSellerMarketingExposures(company.id);
    return Response.json({ exposures });
  } catch (error) {
    return apiError(error);
  }
}
