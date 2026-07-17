import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXPECTED_SUPABASE_PROJECT,
  ProductionMigrationDiagnostic,
  TARGET_MIGRATION,
  formatDiagnostic,
  getConnectionSource,
  isExpectedSupabaseConnection,
  runProductionMigrations,
} from "../scripts/run-production-migrations.mjs";

const directUrl = `postgresql://postgres:credential-placeholder@db.${EXPECTED_SUPABASE_PROJECT}.supabase.co:5432/postgres`;
const poolerUrl = `postgresql://postgres.${EXPECTED_SUPABASE_PROJECT}:credential-placeholder@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

function record(migrationName, overrides = {}) {
  return {
    migration_name: migrationName,
    finished_at: new Date("2026-07-17T00:00:00.000Z"),
    rolled_back_at: null,
    applied_steps_count: 1,
    ...overrides,
  };
}

function fakeClient(responses) {
  const calls = { connect: 0, query: 0, end: 0 };
  return {
    calls,
    client: {
      async connect() {
        calls.connect += 1;
      },
      async query() {
        calls.query += 1;
        return { rows: responses.shift() ?? [] };
      },
      async end() {
        calls.end += 1;
      },
    },
  };
}

const localMigrations = ["20260717090000_previous_migration", TARGET_MIGRATION];
const previousMigration = record(localMigrations[0]);
const appliedTarget = record(TARGET_MIGRATION);

async function assertDiagnostic(promise, expected) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ProductionMigrationDiagnostic);
    assert.equal(error.stage, expected.stage);
    assert.equal(error.source, expected.source);
    assert.equal(error.code, expected.code ?? "unknown");
    return true;
  });
}

test("local and Preview builds skip without opening a database connection", async () => {
  let connections = 0;
  const createClient = () => {
    connections += 1;
    throw new Error("must not connect");
  };

  assert.equal(await runProductionMigrations({ environment: {}, createClient }), "skipped");
  assert.equal(await runProductionMigrations({ environment: { VERCEL_ENV: "preview" }, createClient }), "skipped");
  assert.equal(connections, 0);
});

test("missing or malformed Production URLs identify environment or identity validation", async () => {
  await assertDiagnostic(runProductionMigrations({ environment: { VERCEL_ENV: "production" } }), {
    stage: "environment_validation",
    source: "none",
  });
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: "not-a-database-url" },
  }), {
    stage: "connection_identity_validation",
    source: "DATABASE_URL",
  });
});

test("Supabase verification accepts only the exact direct host or pooler username", () => {
  assert.equal(isExpectedSupabaseConnection(directUrl), true);
  assert.equal(isExpectedSupabaseConnection(poolerUrl), true);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:credential-placeholder@db.other.supabase.co/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres.cjryteuoyiiwsxarblfd.evil:credential-placeholder@host/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:credential-placeholder@db.cjryteuoyiiwsxarblfd.evil/postgres"), false);
});

test("connection source names are limited to DIRECT_URL, DATABASE_URL, or none", () => {
  assert.equal(getConnectionSource({ DIRECT_URL: directUrl, DATABASE_URL: poolerUrl }), "DIRECT_URL");
  assert.equal(getConnectionSource({ DATABASE_URL: poolerUrl }), "DATABASE_URL");
  assert.equal(getConnectionSource({}), "none");
});

test("database connection failures identify the selected source without exposing connection data", async () => {
  const directClient = {
    async connect() {
      const error = new Error("connection details must not escape");
      error.code = "ECONNREFUSED";
      throw error;
    },
    async end() {},
  };
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => directClient,
    localMigrationNames: localMigrations,
  }), {
    stage: "database_connection",
    source: "DIRECT_URL",
    code: "ECONNREFUSED",
  });

  const poolerClient = {
    async connect() {
      const error = new Error("pooler details must not escape");
      error.code = "ETIMEDOUT";
      throw error;
    },
    async end() {},
  };
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: poolerUrl },
    createClient: () => poolerClient,
    localMigrationNames: localMigrations,
  }), {
    stage: "database_connection",
    source: "DATABASE_URL",
    code: "ETIMEDOUT",
  });
});

test("the target migration is the only pending migration before deploy", async () => {
  const fake = fakeClient([[previousMigration], [previousMigration, appliedTarget]]);
  let deploys = 0;
  const result = await runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => { deploys += 1; },
  });
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.deepEqual(fake.calls, { connect: 1, query: 2, end: 1 });
});

test("Prisma subprocess failures identify prisma_migrate_deploy", async () => {
  const fake = fakeClient([[previousMigration]]);
  const subprocessError = new Error("subprocess output must not escape");
  subprocessError.code = "subprocess_exit_1";
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => { throw subprocessError; },
  }), {
    stage: "prisma_migrate_deploy",
    source: "DIRECT_URL",
    code: "subprocess_exit_1",
  });
  assert.equal(fake.calls.end, 1);
});

test("an already-applied target migration skips Prisma", async () => {
  const fake = fakeClient([[previousMigration, appliedTarget]]);
  let deploys = 0;
  const result = await runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => { deploys += 1; },
  });
  assert.equal(result, "already-applied");
  assert.equal(deploys, 0);
  assert.equal(fake.calls.end, 1);
});

test("unexpected pending migrations and failed records fail closed", async () => {
  const unexpected = "20260717130000_unapproved_migration";
  const pending = fakeClient([[previousMigration]]);
  await assert.rejects(() => runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
    createClient: () => pending.client,
    localMigrationNames: [...localMigrations, unexpected],
  }));
  assert.equal(pending.calls.end, 1);

  for (const invalidRecord of [
    record(TARGET_MIGRATION, { finished_at: null }),
    record(TARGET_MIGRATION, { rolled_back_at: new Date("2026-07-17T00:00:00.000Z") }),
    record(TARGET_MIGRATION, { applied_steps_count: 0 }),
  ]) {
    const failed = fakeClient([[previousMigration, invalidRecord]]);
    await assert.rejects(() => runProductionMigrations({
      environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
      createClient: () => failed.client,
      localMigrationNames: localMigrations,
    }));
    assert.equal(failed.calls.end, 1);
  }
});

test("post-deploy verification failure fails closed and closes the connection", async () => {
  const fake = fakeClient([[previousMigration], [previousMigration, record(TARGET_MIGRATION, { applied_steps_count: 2 })]]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }), {
    stage: "target_verification",
    source: "DATABASE_URL",
  });
  assert.equal(fake.calls.end, 1);
});

test("diagnostic output contains only fixed fields and never test connection data", () => {
  const secretUrl = directUrl;
  const output = formatDiagnostic(new ProductionMigrationDiagnostic(
    "database_connection",
    "DIRECT_URL",
    "ECONNRESET",
  ));
  assert.equal(output, [
    "[production-migration] failed stage=database_connection",
    "source=DIRECT_URL",
    "code=ECONNRESET",
  ].join("\n"));
  assert.doesNotMatch(output, /cjryteuoyiiwsxarblfd\.supabase\.co/);
  assert.doesNotMatch(output, /credential-placeholder|postgres|password|secret/i);
  assert.doesNotMatch(output, new RegExp(secretUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
