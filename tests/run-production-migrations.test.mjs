import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXPECTED_SUPABASE_PROJECT,
  LEGACY_ZERO_STEP_MIGRATIONS,
  PREREQUISITE_MIGRATION,
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

function zeroStepRecord(migrationName, overrides = {}) {
  return record(migrationName, { applied_steps_count: 0, ...overrides });
}

function legacySchemaEvidence(overrides = {}) {
  return {
    deal_status_in_progress: true,
    deal_status_completion_requested: true,
    buyer_preferred_supplier_type: true,
    message_attachment_table: true,
    message_content_hash: true,
    message_attachment_file_type: true,
    message_attachment_status: true,
    product_price_unit: true,
    product_moq_quantity: true,
    product_incoterms: true,
    product_suggested_us_channels: true,
    ...overrides,
  };
}

function prerequisitePreflight(overrides = {}) {
  return {
    partner_profile_table: true,
    partner_profile_id_text: true,
    user_profile_table: true,
    user_profile_id_text: true,
    anon_role: true,
    authenticated_role: true,
    referral_claim_token_relations_absent: true,
    referral_claim_token_columns_absent: true,
    referral_claim_token_indexes_absent: true,
    referral_claim_token_constraints_absent: true,
    ...overrides,
  };
}

function prerequisiteSchema(overrides = {}) {
  return {
    referral_claim_token_table: true,
    referral_claim_token_rls: true,
    referral_claim_token_primary_key: true,
    referral_claim_token_columns: true,
    referral_claim_token_hash_index: true,
    referral_claim_token_partner_index: true,
    referral_claim_token_consumed_index: true,
    referral_claim_token_partner_fk: true,
    referral_claim_token_consumed_fk: true,
    referral_claim_token_public_access_revoked: true,
    ...overrides,
  };
}

function targetPreflight(overrides = {}) {
  return {
    target_prerequisite_tables: true,
    target_enum_values_absent: true,
    target_columns_absent: true,
    target_constraints_absent: true,
    target_indexes_absent: true,
    ...overrides,
  };
}

function targetSchema(overrides = {}) {
  return {
    target_enum_values: true,
    target_columns: true,
    target_hold_reason_check: true,
    target_leg_retry_check: true,
    target_reversal_retry_check: true,
    target_approval_fk: true,
    target_indexes: true,
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

const localMigrations = [
  "20260717090000_previous_migration",
  PREREQUISITE_MIGRATION,
  TARGET_MIGRATION,
];
const previousMigration = record(localMigrations[0]);
const appliedPrerequisite = record(PREREQUISITE_MIGRATION);
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
  const fake = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight()],
    [previousMigration, appliedPrerequisite, appliedTarget],
    [prerequisiteSchema()],
    [targetSchema()],
  ]);
  let deploys = 0;
  const result = await runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => { deploys += 1; },
  });
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.deepEqual(fake.calls, { connect: 1, query: 6, end: 1 });
});

test("the recovery state permits only the target migration to remain pending", async () => {
  const fake = fakeClient([
    [previousMigration, appliedPrerequisite],
    [prerequisiteSchema()],
    [targetPreflight()],
    [previousMigration, appliedPrerequisite, appliedTarget],
    [prerequisiteSchema()],
    [targetSchema()],
  ]);
  let deploys = 0;
  const result = await runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => { deploys += 1; },
  });
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.deepEqual(fake.calls, { connect: 1, query: 6, end: 1 });
});

test("prerequisite-only and reversed pending states fail with a safe pending-set diagnostic", async () => {
  const cases = [
    {
      records: [previousMigration, appliedTarget],
      localNames: localMigrations,
    },
    {
      records: [previousMigration, appliedPrerequisite],
      localNames: [...localMigrations, "20260717130000_unapproved_migration"],
    },
    {
      records: [previousMigration, appliedPrerequisite, appliedTarget],
      localNames: [...localMigrations, "20260717130000_unapproved_migration"],
    },
    {
      records: [previousMigration],
      localNames: [localMigrations[0], TARGET_MIGRATION, PREREQUISITE_MIGRATION],
    },
    {
      records: [previousMigration],
      localNames: [...localMigrations, TARGET_MIGRATION],
    },
  ];

  for (const { records, localNames } of cases) {
    const fake = fakeClient([records]);
    await assertDiagnostic(runProductionMigrations({
      environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: localNames,
    }), {
      stage: "migration_state_evaluation",
      source: "DATABASE_URL",
      code: "pending_set_mismatch",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("prerequisite preflight fails closed for missing dependencies or partial objects", async () => {
  for (const missingEvidence of [
    { partner_profile_table: false },
    { partner_profile_id_text: false },
    { user_profile_table: false },
    { user_profile_id_text: false },
    { anon_role: false },
    { authenticated_role: false },
    { referral_claim_token_columns_absent: false },
    { referral_claim_token_indexes_absent: false },
    { referral_claim_token_constraints_absent: false },
  ]) {
    const fake = fakeClient([[previousMigration], [prerequisitePreflight(missingEvidence)]]);
    await assertDiagnostic(runProductionMigrations({
      environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: localMigrations,
    }), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "prerequisite_preflight_failed",
    });
  }
});

test("target preflight and post-verification fail closed on partial schema", async () => {
  const preflightFailure = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight({ target_columns_absent: false })],
  ]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => preflightFailure.client,
    localMigrationNames: localMigrations,
  }), {
    stage: "migration_state_evaluation",
    source: "DIRECT_URL",
    code: "target_preflight_failed",
  });

  const prerequisitePostFailure = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight()],
    [previousMigration, appliedPrerequisite, appliedTarget],
    [prerequisiteSchema({ referral_claim_token_rls: false })],
  ]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => prerequisitePostFailure.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }), {
    stage: "target_verification",
    source: "DIRECT_URL",
    code: "prerequisite_postverify_failed",
  });
});

test("both allowlisted migrations require exactly one applied step after deployment", async () => {
  const prerequisiteStepsFailure = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight()],
    [previousMigration, record(PREREQUISITE_MIGRATION, { applied_steps_count: 2 }), appliedTarget],
    [prerequisiteSchema()],
  ]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => prerequisiteStepsFailure.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }), {
    stage: "target_verification",
    source: "DIRECT_URL",
    code: "prerequisite_postverify_failed",
  });

  const targetStepsFailure = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight()],
    [previousMigration, appliedPrerequisite, zeroStepRecord(TARGET_MIGRATION)],
    [prerequisiteSchema()],
  ]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => targetStepsFailure.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }), {
    stage: "target_verification",
    source: "DIRECT_URL",
    code: "target_postverify_failed",
  });
});

test("the exact legacy zero-step allowlist is accepted with schema evidence", async () => {
  assert.deepEqual(LEGACY_ZERO_STEP_MIGRATIONS, [
    "20260626010000_add_deal_progress_statuses",
    "20260627010000_add_buyer_preferred_supplier_type",
    "20260627020000_add_message_attachments",
    "20260627030000_add_rich_product_fields",
  ]);

  for (const legacyMigration of LEGACY_ZERO_STEP_MIGRATIONS) {
    const fake = fakeClient([
      [zeroStepRecord(legacyMigration)],
      [legacySchemaEvidence()],
      [prerequisitePreflight()],
      [targetPreflight()],
      [zeroStepRecord(legacyMigration), appliedPrerequisite, appliedTarget],
      [prerequisiteSchema()],
      [targetSchema()],
    ]);
    let deploys = 0;
    const result = await runProductionMigrations({
      environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: [legacyMigration, PREREQUISITE_MIGRATION, TARGET_MIGRATION],
      deploy: () => { deploys += 1; },
    });
    assert.equal(result, "deployed");
    assert.equal(deploys, 1);
    assert.deepEqual(fake.calls, { connect: 1, query: 7, end: 1 });
  }
});

test("an allowlisted zero-step migration fails when any required schema evidence is missing", async () => {
  const missingEvidenceByMigration = {
    "20260626010000_add_deal_progress_statuses": "deal_status_completion_requested",
    "20260627010000_add_buyer_preferred_supplier_type": "buyer_preferred_supplier_type",
    "20260627020000_add_message_attachments": "message_attachment_status",
    "20260627030000_add_rich_product_fields": "product_suggested_us_channels",
  };

  for (const legacyMigration of LEGACY_ZERO_STEP_MIGRATIONS) {
    const fake = fakeClient([
      [zeroStepRecord(legacyMigration)],
      [legacySchemaEvidence({ [missingEvidenceByMigration[legacyMigration]]: false })],
    ]);
    await assertDiagnostic(runProductionMigrations({
      environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: [legacyMigration, TARGET_MIGRATION],
    }), {
      stage: "migration_state_evaluation",
      source: "DATABASE_URL",
    });
    assert.equal(fake.calls.query, 2);
    assert.equal(fake.calls.end, 1);
  }
});

test("unknown and target zero-step migrations fail closed", async () => {
  for (const zeroStepMigration of [
    "20260628010000_unknown_zero_step_migration",
    TARGET_MIGRATION,
  ]) {
    const fake = fakeClient([
      [zeroStepRecord(zeroStepMigration)],
      [legacySchemaEvidence()],
    ]);
    await assertDiagnostic(runProductionMigrations({
      environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: [zeroStepMigration],
    }), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("allowlisted zero-step records must be completed and not rolled back", async () => {
  for (const overrides of [
    { finished_at: null },
    { rolled_back_at: new Date("2026-07-17T00:00:00.000Z") },
  ]) {
    const fake = fakeClient([
      [zeroStepRecord(LEGACY_ZERO_STEP_MIGRATIONS[0], overrides)],
      [legacySchemaEvidence()],
    ]);
    await assertDiagnostic(runProductionMigrations({
      environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
      createClient: () => fake.client,
      localMigrationNames: [LEGACY_ZERO_STEP_MIGRATIONS[0], TARGET_MIGRATION],
    }), {
      stage: "migration_state_evaluation",
      source: "DATABASE_URL",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("Prisma subprocess failures identify prisma_migrate_deploy", async () => {
  const fake = fakeClient([[previousMigration], [prerequisitePreflight()], [targetPreflight()]]);
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
  const fake = fakeClient([
    [previousMigration, appliedPrerequisite, appliedTarget],
    [prerequisiteSchema()],
    [targetSchema()],
  ]);
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
  const fake = fakeClient([
    [previousMigration],
    [prerequisitePreflight()],
    [targetPreflight()],
    [previousMigration, appliedPrerequisite, record(TARGET_MIGRATION, { applied_steps_count: 2 })],
    [prerequisiteSchema()],
  ]);
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    deploy: () => {},
  }), {
    stage: "target_verification",
    source: "DATABASE_URL",
    code: "target_postverify_failed",
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
