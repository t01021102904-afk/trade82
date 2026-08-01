import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  requiredStringField,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { respondToSupplierInformationRequest } from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string; requestId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "supplier-information-response",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    rejectUnexpectedFields(body, new Set(["response"]));
    const { id, requestId } = await context.params;
    const informationRequest = await respondToSupplierInformationRequest({
      applicationId: idParam(id),
      requestId: idParam(requestId, "requestId"),
      applicantUserId: user.id,
      response: requiredStringField(body, "response", 4_000),
    });
    return Response.json({ informationRequest });
  } catch (error) {
    return apiError(error);
  }
}
