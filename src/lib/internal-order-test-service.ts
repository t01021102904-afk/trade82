import "server-only";

import { randomUUID } from "node:crypto";

import { InternalOrderTestStatus, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  INTERNAL_ORDER_TEST_LABEL,
  InternalOrderTestError,
  assertCanCancelInternalOrderTest,
  assertCanGenerateInternalOrderTestPayoutPreview,
  assertCanSimulatePayment,
  assertCanSimulateRefund,
  calculateInternalOrderTestFinancials,
  refundStatusForInternalOrderTest,
  type InternalOrderTestStatusValue,
} from "@/lib/internal-order-test-rules";

type TestRun = {
  id: string;
  isInternalTest: boolean;
  testLabel: string;
  testerClerkUserId: string;
  idempotencyKey: string;
  testOrderReference: string;
  status: InternalOrderTestStatus;
  productName: string;
  productAmount: number;
  shippingAmount: number;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  currency: string;
  simulatedPaidAmount: number;
  simulatedRefundAmount: number;
  payoutPreviewAmount: number | null;
  payoutPreviewGeneratedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

function testOrderReference() {
  return `TEST-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

function asStatus(status: InternalOrderTestStatus): InternalOrderTestStatusValue {
  return status as InternalOrderTestStatusValue;
}

function assertVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new InternalOrderTestError("expectedVersion is invalid.", 400);
  }
}

async function findOwnedTestRun(id: string, clerkUserId: string) {
  const run = await getDb().internalOrderTestRun.findFirst({
    where: { id, testerClerkUserId: clerkUserId, isInternalTest: true },
  });
  if (!run) throw new InternalOrderTestError("Internal test order was not found.", 404);
  if (run.testLabel !== INTERNAL_ORDER_TEST_LABEL) {
    throw new InternalOrderTestError("Internal test order marker is invalid.", 403);
  }
  return run as TestRun;
}

export async function listInternalOrderTestRuns(clerkUserId: string) {
  return getDb().internalOrderTestRun.findMany({
    where: { testerClerkUserId: clerkUserId, isInternalTest: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createInternalOrderTestRun(input: {
  clerkUserId: string;
  idempotencyKey: string;
  productName: string;
  productAmount: number;
  shippingAmount: number;
}) {
  const existing = await getDb().internalOrderTestRun.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (existing.testerClerkUserId !== input.clerkUserId || !existing.isInternalTest) {
      throw new InternalOrderTestError("This internal test request cannot be reused.", 403);
    }
    return { run: existing, created: false };
  }

  const financials = calculateInternalOrderTestFinancials(
    input.productAmount,
    input.shippingAmount,
  );

  try {
    const run = await getDb().internalOrderTestRun.create({
      data: {
        isInternalTest: true,
        testLabel: INTERNAL_ORDER_TEST_LABEL,
        testerClerkUserId: input.clerkUserId,
        idempotencyKey: input.idempotencyKey,
        testOrderReference: testOrderReference(),
        productName: input.productName,
        productAmount: input.productAmount,
        shippingAmount: input.shippingAmount,
        grossAmount: financials.grossAmount,
        platformFeeAmount: financials.platformFeeAmount,
        sellerPayableAmount: financials.sellerPayableAmount,
        currency: financials.currency,
      },
    });
    return { run, created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const replay = await getDb().internalOrderTestRun.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!replay || replay.testerClerkUserId !== input.clerkUserId || !replay.isInternalTest) {
      throw new InternalOrderTestError("This internal test request cannot be reused.", 403);
    }
    return { run: replay, created: false };
  }
}

async function updateOwnedTestRun(
  run: TestRun,
  expectedVersion: number,
  data: Prisma.InternalOrderTestRunUpdateManyMutationInput,
) {
  assertVersion(expectedVersion);
  const updated = await getDb().internalOrderTestRun.updateMany({
    where: {
      id: run.id,
      testerClerkUserId: run.testerClerkUserId,
      isInternalTest: true,
      testLabel: INTERNAL_ORDER_TEST_LABEL,
      version: expectedVersion,
    },
    data: { ...data, version: { increment: 1 } },
  });
  if (!updated.count) {
    throw new InternalOrderTestError("This internal test order changed. Refresh and try again.");
  }
  return findOwnedTestRun(run.id, run.testerClerkUserId);
}

export async function simulateInternalOrderTestPayment(input: {
  clerkUserId: string;
  runId: string;
  expectedVersion: number;
}) {
  const run = await findOwnedTestRun(input.runId, input.clerkUserId);
  assertCanSimulatePayment(asStatus(run.status), run.payoutPreviewGeneratedAt);
  return updateOwnedTestRun(run, input.expectedVersion, {
    status: InternalOrderTestStatus.SIMULATED_PAID,
    simulatedPaidAmount: run.grossAmount,
  });
}

export async function simulateInternalOrderTestRefund(input: {
  clerkUserId: string;
  runId: string;
  expectedVersion: number;
  refundAmount: number;
}) {
  const run = await findOwnedTestRun(input.runId, input.clerkUserId);
  assertCanSimulateRefund(
    asStatus(run.status),
    run.simulatedPaidAmount,
    input.refundAmount,
    run.payoutPreviewGeneratedAt,
  );
  return updateOwnedTestRun(run, input.expectedVersion, {
    status: refundStatusForInternalOrderTest(run.simulatedPaidAmount, input.refundAmount),
    simulatedRefundAmount: input.refundAmount,
  });
}

export async function generateInternalOrderTestPayoutPreview(input: {
  clerkUserId: string;
  runId: string;
  expectedVersion: number;
}) {
  const run = await findOwnedTestRun(input.runId, input.clerkUserId);
  if (run.payoutPreviewGeneratedAt) return { run, created: false };
  const payoutPreviewAmount = assertCanGenerateInternalOrderTestPayoutPreview({
    status: asStatus(run.status),
    simulatedPaidAmount: run.simulatedPaidAmount,
    sellerPayableAmount: run.sellerPayableAmount,
    simulatedRefundAmount: run.simulatedRefundAmount,
  });
  const updated = await updateOwnedTestRun(run, input.expectedVersion, {
    payoutPreviewAmount,
    payoutPreviewGeneratedAt: new Date(),
  });
  return { run: updated, created: true };
}

export async function cancelInternalOrderTestRun(input: {
  clerkUserId: string;
  runId: string;
  expectedVersion: number;
}) {
  const run = await findOwnedTestRun(input.runId, input.clerkUserId);
  assertCanCancelInternalOrderTest(asStatus(run.status));
  return updateOwnedTestRun(run, input.expectedVersion, {
    status: InternalOrderTestStatus.CANCELLED,
  });
}
