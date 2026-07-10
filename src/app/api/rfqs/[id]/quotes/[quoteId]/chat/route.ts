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
import { createOrReuseRfqQuoteConversation } from "@/lib/rfq-db";

function responseError(error: Response) {
  return error.text().then((message) =>
    Response.json(
      { error: message || "Request failed." },
      { status: error.status },
    ),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  try {
    const { user } = await requireBuyer();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "buyer-rfq-chat",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId, quoteId: rawQuoteId } = await params;
    const rfqId = idParam(rawId, "rfqId");
    const quoteId = idParam(rawQuoteId, "quoteId");
    const body = await readJsonObject(request);
    const locale = enumField(body, "locale", ["en", "ko"], "en");

    return Response.json(
      await createOrReuseRfqQuoteConversation({
        buyerUserId: user.id,
        rfqId,
        quoteId,
        locale,
      }),
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    if (error instanceof Response) {
      return responseError(error);
    }
    return apiError(error);
  }
}
