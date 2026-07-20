import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSettlementWorkerAuthorization } from "../src/lib/settlement-worker-auth.ts";
import {
  createSettlementWorkerClock,
  resolveSettlementWorkerRunStatus,
  runSettlementReversalBatch,
  runSettlementTransferBatch,
  toSafeSettlementMetricInteger,
} from "../src/lib/settlement-operations-control-plane.ts";
import { SettlementWorkerRunStatus } from "../src/generated/prisma/client.ts";
import { parseStripeConnectExecutionMode } from "../src/lib/stripe-connect-execution-mode.ts";

function withEnvironment<T>(values: Record<string, string | undefined>, callback: () => Promise<T> | T): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(callback()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function skippedWorkerDb() {
  const calls: string[] = [];
  return {
    calls,
    db: {
      settlementWorkerRun: {
        create: async () => {
          calls.push("worker_run.create");
          return { id: "worker_run_1" };
        },
      },
    },
  };
}

function emptyAutoWorkerDb() {
  const calls: string[] = [];
  return {
    calls,
    db: {
      settlementWorkerRun: {
        create: async () => {
          calls.push("worker_run.create");
          return { id: "worker_run_1", startedAt: new Date("2026-07-19T12:00:00.000Z") };
        },
        update: async () => {
          calls.push("worker_run.update");
          return { id: "worker_run_1" };
        },
      },
      $transaction: async (callback: (tx: { $queryRaw: () => Promise<unknown[]> }) => Promise<unknown>) => (
        callback({
          $queryRaw: async () => {
            calls.push("candidate_query");
            return [];
          },
        })
      ),
    },
  };
}

function timedWorkerDb(candidates: Array<{ id: string; staleRecovery?: boolean; settlementId?: string }>) {
  const calls: string[] = [];
  return {
    calls,
    db: {
      settlementWorkerRun: {
        create: async ({ data }: { data: { startedAt: Date } }) => {
          calls.push("worker_run.create");
          return { id: "worker_run_timeout", startedAt: data.startedAt };
        },
        update: async () => {
          calls.push("worker_run.update");
          return { id: "worker_run_timeout" };
        },
      },
      settlementOperationalAlert: {
        upsert: async () => {
          calls.push("operational_alert.upsert");
          return { id: "worker_timeout_alert", occurrenceCount: 1, status: "OPEN" };
        },
      },
      $transaction: async (callback: (tx: { $queryRaw: () => Promise<unknown[]> }) => Promise<unknown>) => callback({
        $queryRaw: async () => {
          calls.push("candidate_query");
          return candidates;
        },
      }),
    },
  };
}

function sequenceClock(values: Date[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test("execution-mode parsing supports only off, manual, and auto", () => {
  assert.equal(parseStripeConnectExecutionMode(undefined), "off");
  assert.equal(parseStripeConnectExecutionMode(""), "off");
  assert.equal(parseStripeConnectExecutionMode(" unknown "), "off");
  assert.equal(parseStripeConnectExecutionMode(" MANUAL "), "manual");
  assert.equal(parseStripeConnectExecutionMode(" auto "), "auto");
});

test("the default production worker clock returns a fresh Date for each read", () => {
  const readNow = createSettlementWorkerClock();
  const first = readNow();
  const second = readNow();

  assert.notEqual(first, second);
  assert.ok(second.getTime() >= first.getTime());
});

test("worker accounting treats manual review as failure and empty runs as success", () => {
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 0, failedCount: 0, manualReviewCount: 0, succeededCount: 0 }), SettlementWorkerRunStatus.SUCCEEDED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 1, failedCount: 0, manualReviewCount: 1, succeededCount: 0 }), SettlementWorkerRunStatus.FAILED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 2, failedCount: 0, manualReviewCount: 1, succeededCount: 1 }), SettlementWorkerRunStatus.PARTIALLY_FAILED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 1, failedCount: 1, manualReviewCount: 0, succeededCount: 0 }), SettlementWorkerRunStatus.FAILED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 1, failedCount: 0, manualReviewCount: 0, succeededCount: 1 }), SettlementWorkerRunStatus.SUCCEEDED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 1, failedCount: 0, manualReviewCount: 0, succeededCount: 0, timedOut: true }), SettlementWorkerRunStatus.FAILED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 2, failedCount: 0, manualReviewCount: 0, succeededCount: 1, timedOut: true }), SettlementWorkerRunStatus.PARTIALLY_FAILED);
  assert.equal(resolveSettlementWorkerRunStatus({ scannedCount: 0, failedCount: 0, manualReviewCount: 0, succeededCount: 0, timedOut: true }), SettlementWorkerRunStatus.SUCCEEDED);
});

test("metric aggregate conversion accepts values above int32 and rejects unsafe integers", () => {
  assert.equal(toSafeSettlementMetricInteger("2147483648"), 2_147_483_648);
  assert.equal(toSafeSettlementMetricInteger(BigInt(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.throws(() => toSafeSettlementMetricInteger("9007199254740992"), /metrics_aggregate_unsafe/);
});

test("transfer worker timeout before success persists FAILED and skips unprocessed rows", async () => {
  const startedAt = new Date("2026-07-19T12:00:00.000Z");
  const fixture = timedWorkerDb([{ id: "leg_1" }, { id: "leg_2" }]);
  let executorCalls = 0;
  const result = await withEnvironment({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "auto" }, () => runSettlementTransferBatch({
    db: fixture.db as never,
    clock: sequenceClock([startedAt, new Date(startedAt.getTime() + 300_000), new Date(startedAt.getTime() + 300_000)]),
    transferExecutor: async () => {
      executorCalls += 1;
      return { ok: true, settlementLegId: "leg_1", status: "transferred", retryable: false } as never;
    },
  }));
  assert.equal(result.status, SettlementWorkerRunStatus.FAILED);
  assert.equal(result.timedOut, true);
  assert.equal(result.skippedCount, 2);
  assert.equal(result.claimedCount, 0);
  assert.equal(executorCalls, 0);
  assert.ok(fixture.calls.includes("operational_alert.upsert"));
});

test("reversal worker timeout after success persists PARTIALLY_FAILED", async () => {
  const startedAt = new Date("2026-07-19T12:00:00.000Z");
  const fixture = timedWorkerDb([{ id: "reversal_1", settlementId: "settlement_1" }, { id: "reversal_2", settlementId: "settlement_1" }]);
  let executorCalls = 0;
  const result = await withEnvironment({ STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: "auto" }, () => runSettlementReversalBatch({
    db: fixture.db as never,
    clock: sequenceClock([startedAt, startedAt, new Date(startedAt.getTime() + 300_000), new Date(startedAt.getTime() + 300_000)]),
    reversalExecutor: async () => {
      executorCalls += 1;
      return { ok: true, settlementReversalId: "reversal_1", status: "reversed", retryable: false } as never;
    },
  }));
  assert.equal(result.status, SettlementWorkerRunStatus.PARTIALLY_FAILED);
  assert.equal(result.timedOut, true);
  assert.equal(result.succeededCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(executorCalls, 1);
});

test("off and manual transfer workers create no Stripe calls and do not query candidates", async () => {
  for (const mode of [undefined, "", "manual"]) {
    const fixture = skippedWorkerDb();
    let stripeCalls = 0;
    await withEnvironment({ STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: mode }, async () => {
      const result = await runSettlementTransferBatch({
        db: fixture.db as never,
        stripe: { transfers: { create: async () => { stripeCalls += 1; return { id: "tr_never" }; } } } as never,
      });
      assert.equal(result.status, "SKIPPED");
      assert.equal(result.executionMode, mode === "manual" ? "manual" : "off");
    });
    assert.deepEqual(fixture.calls, ["worker_run.create"]);
    assert.equal(stripeCalls, 0);
  }
});

test("off and manual reversal workers create no Stripe calls and do not query candidates", async () => {
  for (const mode of [undefined, "", "manual"]) {
    const fixture = skippedWorkerDb();
    let stripeCalls = 0;
    await withEnvironment({ STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: mode }, async () => {
      const result = await runSettlementReversalBatch({
        db: fixture.db as never,
        stripe: { transfers: { createReversal: async () => { stripeCalls += 1; return { id: "trr_never" }; } } } as never,
      });
      assert.equal(result.status, "SKIPPED");
      assert.equal(result.executionMode, mode === "manual" ? "manual" : "off");
    });
    assert.deepEqual(fixture.calls, ["worker_run.create"]);
    assert.equal(stripeCalls, 0);
  }
});

test("auto workers use a bounded candidate query and continue safely with an empty fixture", async () => {
  const transferFixture = emptyAutoWorkerDb();
  const reversalFixture = emptyAutoWorkerDb();
  let stripeCalls = 0;
  await withEnvironment({
    STRIPE_CONNECT_TRANSFER_EXECUTION_MODE: "auto",
    STRIPE_CONNECT_REVERSAL_EXECUTION_MODE: "auto",
  }, async () => {
    const [transfer, reversal] = await Promise.all([
      runSettlementTransferBatch({ db: transferFixture.db as never, stripe: { transfers: { create: async () => { stripeCalls += 1; return { id: "tr_never" }; } } } as never, batchSize: 20 }),
      runSettlementReversalBatch({ db: reversalFixture.db as never, stripe: { transfers: { createReversal: async () => { stripeCalls += 1; return { id: "trr_never" }; } } } as never, batchSize: 20 }),
    ]);
    assert.equal(transfer.status, "SUCCEEDED");
    assert.equal(reversal.status, "SUCCEEDED");
    assert.equal(transfer.scannedCount, 0);
    assert.equal(reversal.scannedCount, 0);
  });
  assert.deepEqual(transferFixture.calls, ["worker_run.create", "candidate_query", "worker_run.update"]);
  assert.deepEqual(reversalFixture.calls, ["worker_run.create", "candidate_query", "worker_run.update"]);
  assert.equal(stripeCalls, 0);
});

test("worker authentication fails closed and compares the bearer secret in constant time", async () => {
  await withEnvironment({ SETTLEMENT_WORKER_SECRET: "test-worker-secret" }, () => {
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal")), false);
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secre" } })), false);
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secret-too-long" } })), false);
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secret" } })), true);
  });

  await withEnvironment({ SETTLEMENT_WORKER_SECRET: undefined }, () => {
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secret" } })), false);
  });
});
