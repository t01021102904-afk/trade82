import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXPECTED_SUPABASE_PROJECT,
  TARGET_MIGRATION,
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

test("missing or malformed Production URLs fail closed", async () => {
  await assert.rejects(() => runProductionMigrations({ environment: { VERCEL_ENV: "production" } }));
  await assert.rejects(() => runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: "not-a-database-url" },
  }));
});

test("Supabase verification accepts only the exact direct host or pooler username", () => {
  assert.equal(isExpectedSupabaseConnection(directUrl), true);
  assert.equal(isExpectedSupabaseConnection(poolerUrl), true);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:credential-placeholder@db.other.supabase.co/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres.cjryteuoyiiwsxarblfd.evil:credential-placeholder@host/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:credential-placeholder@db.cjryteuoyiiwsxarblfd.evil/postgres"), false);
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
  await assert.rejects(() => runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }));
  assert.equal(fake.calls.end, 1);
});
