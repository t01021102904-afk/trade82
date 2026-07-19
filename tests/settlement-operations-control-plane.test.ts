import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSettlementWorkerAuthorization } from "../src/lib/settlement-worker-auth.ts";
import {
  runSettlementReversalBatch,
  runSettlementTransferBatch,
} from "../src/lib/settlement-operations-control-plane.ts";
import { parseStripeConnectExecutionMode } from "../src/lib/stripe-connect-execution-mode.ts";

function withEnvironment(values: Record<string, string | undefined>, callback: () => Promise<void> | void) {
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

test("execution-mode parsing supports only off, manual, and auto", () => {
  assert.equal(parseStripeConnectExecutionMode(undefined), "off");
  assert.equal(parseStripeConnectExecutionMode(""), "off");
  assert.equal(parseStripeConnectExecutionMode(" unknown "), "off");
  assert.equal(parseStripeConnectExecutionMode(" MANUAL "), "manual");
  assert.equal(parseStripeConnectExecutionMode(" auto "), "auto");
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
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secret" } })), true);
  });

  await withEnvironment({ SETTLEMENT_WORKER_SECRET: undefined }, () => {
    assert.equal(hasSettlementWorkerAuthorization(new Request("https://trade82.test/internal", { headers: { authorization: "Bearer test-worker-secret" } })), false);
  });
});
