import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";

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

test("settlement operations migration exposes locked, private operational tables with no rows", async () => {
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
