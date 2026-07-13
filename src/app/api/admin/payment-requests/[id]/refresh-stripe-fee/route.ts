import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { refreshStripeProcessingFeeForPaymentRequest } from "@/lib/payment-requests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-message-payment-refresh-stripe-fee",
      userId: admin.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const paymentRequestId = idParam(rawId, "paymentRequestId");
    const result = await refreshStripeProcessingFeeForPaymentRequest(paymentRequestId);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.error === "Payment request not found." ? 404 : 409 });
    }
    return Response.json({ ok: true, stripeProcessingFeeAmount: result.details.stripeProcessingFeeAmount });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
