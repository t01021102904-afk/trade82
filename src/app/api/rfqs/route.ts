import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  rateLimitOrResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireBuyer } from "@/lib/authz";
import { createBuyerRfq, listBuyerRfqs, validateRfqInput } from "@/lib/rfq-db";

export async function GET() {
  try {
    const { user } = await requireBuyer();
    return Response.json(await listBuyerRfqs(user.id));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, company } = await requireBuyer();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "buyer-rfq-create",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const rfq = await createBuyerRfq({
      buyerUserId: user.id,
      buyerCompanyId: company?.id ?? null,
      input: validateRfqInput(body),
    });
    return Response.json(rfq, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
