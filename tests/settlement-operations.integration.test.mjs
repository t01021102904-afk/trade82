import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import {
  queryOperationsMigrationInitialState,
  queryOperationsMigrationSchema,
} from "../scripts/run-production-migrations.mjs";

const { Pool } = pg;
const DATABASE_PREFIX = "trade82_settlement_operations_test_";

function localDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration test");
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(url.hostname), "integration test requires localhost PostgreSQL");
  assert.ok(url.pathname.slice(1).startsWith(DATABASE_PREFIX), "integration test requires a disposable database name");
  return value;
}

test("settlement operations migration exposes the durable catalog contract and starts empty", async () => {
  const pool = new Pool({ connectionString: localDatabaseUrl(), max: 1 });
  try {
    const client = await pool.connect();
    try {
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
        ORDER BY table_name
      `);
      assert.deepEqual(tables.rows.map((row) => row.table_name), ["SettlementOperationalAlert", "SettlementWorkerRun"]);

      const schema = await queryOperationsMigrationSchema(client);
      for (const [key, value] of Object.entries(schema)) {
        assert.equal(value, true, key);
      }
      const initialState = await queryOperationsMigrationInitialState(client);
      assert.deepEqual(initialState, {
        operations_worker_run_zero_rows: true,
        operations_alert_zero_rows: true,
      });

      const enums = await client.query(`
        SELECT t.typname, e.enumlabel
        FROM pg_type AS t
        JOIN pg_namespace AS n ON n.oid = t.typnamespace
        JOIN pg_enum AS e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public'
          AND t.typname IN ('SettlementPaymentFlow', 'SettlementWorkerType', 'SettlementOperationalAlertType')
        ORDER BY t.typname, e.enumsortorder
      `);
      assert.ok(enums.rows.some((row) => row.typname === "SettlementPaymentFlow" && row.enumlabel === "SCT"));
      assert.ok(enums.rows.some((row) => row.typname === "SettlementPaymentFlow" && row.enumlabel === "DIRECT_CHARGE"));
      assert.ok(enums.rows.some((row) => row.typname === "SettlementWorkerType" && row.enumlabel === "STALE_RECOVERY"));
      assert.ok(enums.rows.some((row) => row.typname === "SettlementOperationalAlertType" && row.enumlabel === "WORKER_FAILED"));

      const rls = await client.query(`
        SELECT c.relname, c.relrowsecurity
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
        ORDER BY c.relname
      `);
      assert.deepEqual(rls.rows, [
        { relname: "SettlementOperationalAlert", relrowsecurity: true },
        { relname: "SettlementWorkerRun", relrowsecurity: true },
      ]);

      const privileges = await client.query(`
        SELECT table_name,
          has_table_privilege('anon', format('%I.%I', table_schema, table_name), 'SELECT') AS anon_select,
          has_table_privilege('authenticated', format('%I.%I', table_schema, table_name), 'SELECT') AS authenticated_select
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
        ORDER BY table_name
      `);
      assert.deepEqual(privileges.rows, [
        { table_name: "SettlementOperationalAlert", anon_select: false, authenticated_select: false },
        { table_name: "SettlementWorkerRun", anon_select: false, authenticated_select: false },
      ]);

      for (const table of ["SettlementWorkerRun", "SettlementOperationalAlert"]) {
        const result = await client.query(`SELECT count(*)::int AS count FROM public."${table}"`);
        assert.equal(result.rows[0].count, 0, `${table} must start empty`);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
});

test("operational catalog checks remain durable after legitimate worker and alert rows exist", async () => {
  const pool = new Pool({ connectionString: localDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DELETE FROM public."SettlementOperationalAlert"
      WHERE "id" = 'ops-integration-alert'
    `);
    await client.query(`
      DELETE FROM public."SettlementWorkerRun"
      WHERE "id" = 'ops-integration-worker'
    `);
    await client.query(`
      INSERT INTO public."SettlementWorkerRun"
        ("id", "workerType", "executionMode", "status", "startedAt", "completedAt", "updatedAt")
      VALUES ('ops-integration-worker', 'TRANSFER', 'auto', 'SUCCEEDED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    await client.query(`
      INSERT INTO public."SettlementOperationalAlert"
        ("id", "alertType", "severity", "status", "title", "sanitizedMessage", "deduplicationKey", "updatedAt")
      VALUES ('ops-integration-alert', 'WORKER_FAILED', 'CRITICAL', 'OPEN', 'Integration alert', 'safe diagnostic', 'ops-integration-alert', CURRENT_TIMESTAMP)
    `);

    const schema = await queryOperationsMigrationSchema(client);
    for (const [key, value] of Object.entries(schema)) {
      assert.equal(value, true, key);
    }
    const initialState = await queryOperationsMigrationInitialState(client);
    assert.deepEqual(initialState, {
      operations_worker_run_zero_rows: false,
      operations_alert_zero_rows: false,
    });
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
});

test("operational catalog verification rejects malformed indexes, defaults, constraints, RLS, and privileges", async (t) => {
  const pool = new Pool({ connectionString: localDatabaseUrl(), max: 1 });
  const cases = [
    {
      name: "partial operational index",
      key: "operations_indexes",
      mutation: async (client) => {
        await client.query('DROP INDEX "SettlementWorkerRun_status_startedAt_idx"');
        await client.query('CREATE INDEX "SettlementWorkerRun_status_startedAt_idx" ON "SettlementWorkerRun" ("status", "startedAt") WHERE "status" = \'RUNNING\'');
      },
    },
    {
      name: "non-btree operational index",
      key: "operations_indexes",
      mutation: async (client) => {
        await client.query('DROP INDEX "SettlementWorkerRun_status_startedAt_idx"');
        await client.query('CREATE INDEX "SettlementWorkerRun_status_startedAt_idx" ON "SettlementWorkerRun" USING hash ("status")');
      },
    },
    {
      name: "extra worker column",
      key: "operations_worker_columns",
      mutation: (client) => client.query('ALTER TABLE "SettlementWorkerRun" ADD COLUMN "catalogMutationExtra" TEXT'),
    },
    {
      name: "unexpected worker default",
      key: "operations_worker_columns",
      mutation: (client) => client.query('ALTER TABLE "SettlementWorkerRun" ALTER COLUMN "scannedCount" SET DEFAULT 1'),
    },
    {
      name: "unexpected alert default",
      key: "operations_alert_columns",
      mutation: (client) => client.query('ALTER TABLE "SettlementOperationalAlert" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP'),
    },
    {
      name: "wrong deduplication constraint",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementOperationalAlert" DROP CONSTRAINT "SettlementOperationalAlert_deduplicationKey_key"');
        await client.query('ALTER TABLE "SettlementOperationalAlert" ADD CONSTRAINT "SettlementOperationalAlert_title_key" UNIQUE ("title")');
      },
    },
    {
      name: "worker primary key on wrong column",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementOperationalAlert" DROP CONSTRAINT "SettlementOperationalAlert_workerRunId_fkey"');
        await client.query('ALTER TABLE "SettlementWorkerRun" DROP CONSTRAINT "SettlementWorkerRun_pkey"');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_id_key" UNIQUE ("id")');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_pkey" PRIMARY KEY ("startedAt")');
        await client.query('ALTER TABLE "SettlementOperationalAlert" ADD CONSTRAINT "SettlementOperationalAlert_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "SettlementWorkerRun"("id") ON DELETE SET NULL ON UPDATE CASCADE');
      },
    },
    {
      name: "alert primary key on wrong column",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementOperationalAlert" DROP CONSTRAINT "SettlementOperationalAlert_pkey"');
        await client.query('ALTER TABLE "SettlementOperationalAlert" ADD CONSTRAINT "SettlementOperationalAlert_pkey" PRIMARY KEY ("createdAt")');
      },
    },
    {
      name: "weakened worker count check",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementWorkerRun" DROP CONSTRAINT "SettlementWorkerRun_counts_check"');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_counts_check" CHECK ("scannedCount" >= 0)');
      },
    },
    {
      name: "changed worker count comparison operator",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementWorkerRun" DROP CONSTRAINT "SettlementWorkerRun_counts_check"');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_counts_check" CHECK ("scannedCount" > 0 AND "claimedCount" >= 0 AND "succeededCount" >= 0 AND "failedCount" >= 0 AND "skippedCount" >= 0 AND "manualReviewCount" >= 0 AND "staleRecoveredCount" >= 0 AND ("durationMs" IS NULL OR "durationMs" >= 0))');
      },
    },
    {
      name: "omitted worker count condition",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementWorkerRun" DROP CONSTRAINT "SettlementWorkerRun_counts_check"');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_counts_check" CHECK ("scannedCount" >= 0 AND "claimedCount" >= 0 AND "succeededCount" >= 0 AND "failedCount" >= 0 AND "skippedCount" >= 0 AND "manualReviewCount" >= 0 AND "staleRecoveredCount" >= 0)');
      },
    },
    {
      name: "additional worker count condition",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementWorkerRun" DROP CONSTRAINT "SettlementWorkerRun_counts_check"');
        await client.query('ALTER TABLE "SettlementWorkerRun" ADD CONSTRAINT "SettlementWorkerRun_counts_check" CHECK ("scannedCount" >= 0 AND "claimedCount" >= 0 AND "succeededCount" >= 0 AND "failedCount" >= 0 AND "skippedCount" >= 0 AND "manualReviewCount" >= 0 AND "staleRecoveredCount" >= 0 AND ("durationMs" IS NULL OR "durationMs" >= 0) AND "durationMs" IS NULL)');
      },
    },
    {
      name: "weakened alert occurrence check",
      key: "operations_constraints",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementOperationalAlert" DROP CONSTRAINT "SettlementOperationalAlert_occurrenceCount_check"');
        await client.query('ALTER TABLE "SettlementOperationalAlert" ADD CONSTRAINT "SettlementOperationalAlert_occurrenceCount_check" CHECK ("occurrenceCount" >= 0)');
      },
    },
    {
      name: "wrong worker error-code typmod",
      key: "operations_worker_columns",
      mutation: (client) => client.query('ALTER TABLE "SettlementWorkerRun" ALTER COLUMN "sanitizedErrorCode" TYPE VARCHAR(63)'),
    },
    {
      name: "wrong alert message typmod",
      key: "operations_alert_columns",
      mutation: (client) => client.query('ALTER TABLE "SettlementOperationalAlert" ALTER COLUMN "sanitizedMessage" TYPE VARCHAR(999)'),
    },
    {
      name: "wrong worker-run foreign key target",
      key: "operations_restrictive_fks",
      mutation: async (client) => {
        await client.query('ALTER TABLE "SettlementOperationalAlert" DROP CONSTRAINT "SettlementOperationalAlert_workerRunId_fkey"');
        await client.query('ALTER TABLE "SettlementOperationalAlert" ADD CONSTRAINT "SettlementOperationalAlert_workerRunId_fkey" FOREIGN KEY ("workerRunId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE');
      },
    },
    {
      name: "RLS disabled",
      key: "operations_rls",
      mutation: (client) => client.query('ALTER TABLE "SettlementWorkerRun" DISABLE ROW LEVEL SECURITY'),
    },
    {
      name: "public role privilege granted",
      key: "operations_public_access_revoked",
      mutation: (client) => client.query('GRANT SELECT ON TABLE "SettlementOperationalAlert" TO anon'),
    },
  ];

  try {
    for (const testCase of cases) {
      await t.test(testCase.name, async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await testCase.mutation(client);
          const schema = await queryOperationsMigrationSchema(client);
          assert.equal(schema[testCase.key], false, testCase.key);
        } finally {
          await client.query("ROLLBACK").catch(() => {});
          client.release();
        }
      });
    }
  } finally {
    await pool.end();
  }
});
