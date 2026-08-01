import { apiError } from "@/lib/api-response";
import { requireAuth } from "@/lib/authz";
import {
  getCurrentSupplierApplication,
  supplierApplicationSafeResponse,
} from "@/lib/supplier-application";

export async function GET() {
  try {
    const user = await requireAuth();
    const application = await getCurrentSupplierApplication(user.id);
    return Response.json(
      { application: application ? supplierApplicationSafeResponse(application) : null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
