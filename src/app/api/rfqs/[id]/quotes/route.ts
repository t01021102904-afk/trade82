import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idField,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireBuyer } from "@/lib/authz";
import { createOrReuseRfqSellerQuote } from "@/lib/rfq-db";

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireBuyer();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "buyer-rfq-select-seller",
      userId: user.id,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const rfqId = idParam(rawId, "rfqId");
    const body = await readJsonObject(request);
    const productId = idField(body, "productId", { required: true });
    const sellerCompanyId = idField(body, "sellerCompanyId", { required: true });

    if (!productId || !sellerCompanyId) {
      return Response.json(
        { error: "Product and seller are required." },
        { status: 400 },
      );
    }

    return Response.json(
      await createOrReuseRfqSellerQuote({
        buyerUserId: user.id,
        rfqId,
        productId,
        sellerCompanyId,
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
