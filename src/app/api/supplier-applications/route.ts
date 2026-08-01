import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  rateLimitOrResponse,
  readJsonObject,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import {
  createOrResumeSupplierApplication,
  parseSupplierApplicationCreateInput,
} from "@/lib/supplier-application";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "supplier-application-create",
      userId: user.id,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const body = await readJsonObject(request);
    const result = await createOrResumeSupplierApplication({
      userId: user.id,
      input: parseSupplierApplicationCreateInput(body),
    });
    return Response.json(
      {
        application: {
          id: result.application.id,
          applicationNumber: result.application.applicationNumber,
          status: result.application.status,
        },
        resumed: result.resumed,
      },
      { status: result.resumed ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
