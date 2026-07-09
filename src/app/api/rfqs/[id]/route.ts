import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireBuyer } from "@/lib/authz";
import {
  getBuyerRfq,
  setBuyerRfqLifecycleStatus,
  updateBuyerRfq,
  validateRfqInput,
} from "@/lib/rfq-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireBuyer();
    const { id: rawId } = await params;
    const id = idParam(rawId, "rfqId");
    const rfq = await getBuyerRfq(user.id, id);
    if (!rfq) {
      return Response.json({ error: "RFQ not found." }, { status: 404 });
    }
    return Response.json(rfq);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireBuyer();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "buyer-rfq-update",
      userId: user.id,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "rfqId");
    const body = await readJsonObject(request);

    if ("action" in body) {
      const action = enumField(body, "action", ["cancel", "close"]);
      const status = action === "cancel" ? "CANCELLED" : "CLOSED";
      return Response.json(
        await setBuyerRfqLifecycleStatus({
          buyerUserId: user.id,
          id,
          status,
        }),
      );
    }

    return Response.json(
      await updateBuyerRfq({
        buyerUserId: user.id,
        id,
        input: validateRfqInput(body),
      }),
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
