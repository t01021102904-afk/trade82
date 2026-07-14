import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  assertSameOrigin,
  enumField,
  rateLimitOrResponse,
  readJsonObject,
  rejectUnexpectedFields,
  requiredIdField,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireInternalOrderTestAccess } from "@/lib/internal-order-test-feature";
import {
  InternalOrderTestError,
} from "@/lib/internal-order-test-rules";
import {
  cancelInternalOrderTestRun,
  createInternalOrderTestRun,
  generateInternalOrderTestPayoutPreview,
  listInternalOrderTestRuns,
  simulateInternalOrderTestPayment,
  simulateInternalOrderTestRefund,
} from "@/lib/internal-order-test-service";
import { parseUsdMinorUnits } from "@/lib/payment-requests";

const actions = [
  "create",
  "simulate-payment",
  "simulate-refund",
  "payout-preview",
  "cancel",
] as const;

const fieldsByAction: Record<(typeof actions)[number], ReadonlySet<string>> = {
  create: new Set(["action", "idempotencyKey", "productName", "productAmount", "shippingAmount"]),
  "simulate-payment": new Set(["action", "runId", "expectedVersion"]),
  "simulate-refund": new Set(["action", "runId", "expectedVersion", "refundAmount"]),
  "payout-preview": new Set(["action", "runId", "expectedVersion"]),
  cancel: new Set(["action", "runId", "expectedVersion"]),
};

function idempotencyKey(body: Record<string, unknown>) {
  const key = stringField(body, "idempotencyKey", { required: true, max: 128 }) as string;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw validationError("idempotencyKey is invalid.");
  }
  return key;
}

function expectedVersion(body: Record<string, unknown>) {
  const value = body.expectedVersion;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw validationError("expectedVersion is invalid.");
  }
  return value;
}

export async function GET() {
  try {
    const access = await requireInternalOrderTestAccess();
    const runs = await listInternalOrderTestRuns(access.clerkUserId);
    return Response.json({ runs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = await requireInternalOrderTestAccess();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "internal-order-system-test",
      userId: access.clerkUserId,
      limit: 60,
      windowMs: 60 * 60_000,
      message: "Too many internal test actions. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const action = enumField(body, "action", actions);
    rejectUnexpectedFields(body, fieldsByAction[action]);

    if (action === "create") {
      const result = await createInternalOrderTestRun({
        clerkUserId: access.clerkUserId,
        idempotencyKey: idempotencyKey(body),
        productName: stringField(body, "productName", { required: true, max: 240 }) as string,
        productAmount: parseUsdMinorUnits(body.productAmount, "productAmount", 1),
        shippingAmount: parseUsdMinorUnits(body.shippingAmount ?? "0", "shippingAmount"),
      });
      return Response.json(result, { status: result.created ? 201 : 200 });
    }

    const runId = requiredIdField(body, "runId");
    const version = expectedVersion(body);

    if (action === "simulate-payment") {
      return Response.json({
        run: await simulateInternalOrderTestPayment({
          clerkUserId: access.clerkUserId,
          runId,
          expectedVersion: version,
        }),
      });
    }

    if (action === "simulate-refund") {
      return Response.json({
        run: await simulateInternalOrderTestRefund({
          clerkUserId: access.clerkUserId,
          runId,
          expectedVersion: version,
          refundAmount: parseUsdMinorUnits(body.refundAmount, "refundAmount", 1),
        }),
      });
    }

    if (action === "payout-preview") {
      return Response.json(
        await generateInternalOrderTestPayoutPreview({
          clerkUserId: access.clerkUserId,
          runId,
          expectedVersion: version,
        }),
      );
    }

    return Response.json({
      run: await cancelInternalOrderTestRun({
        clerkUserId: access.clerkUserId,
        runId,
        expectedVersion: version,
      }),
    });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof InternalOrderTestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
