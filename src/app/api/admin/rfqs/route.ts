import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  idField,
  rateLimitOrResponse,
  readJsonObject,
  stringField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { listAdminRfqs, reviewAdminRfq } from "@/lib/rfq-db";

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await listAdminRfqs());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-rfq-review",
      userId: admin.id,
      limit: 80,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const id = idField(body, "id", { required: true });
    if (!id) {
      return Response.json({ error: "RFQ id is required." }, { status: 400 });
    }
    const action = enumField(body, "action", ["approve", "reject", "note"]);
    const adminNote =
      stringField(body, "adminNote", { max: 2_000, fallback: "" }) || null;

    return Response.json(
      await reviewAdminRfq({
        adminUserId: admin.id,
        id,
        action,
        adminNote,
      }),
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
