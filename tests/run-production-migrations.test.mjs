import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APPROVED_PRODUCTION_MIGRATION_BATCH,
  EXPECTED_SUPABASE_PROJECT,
  FIRST_APPROVED_MIGRATION,
  LEGACY_ZERO_STEP_MIGRATIONS,
  ProductionMigrationDiagnostic,
  RELEASE_APPROVAL_MIGRATION,
  TARGET_MIGRATION,
  formatDiagnostic,
  getConnectionSource,
  isExpectedSupabaseConnection,
  readLocalMigrationNames,
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

function releaseApprovalSchema(overrides = {}) {
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

function firstPreflight(overrides = {}) {
  return {
    first_settlement_reversal_table: true,
    first_settlement_leg_table: true,
    first_settlement_reversal_settlement_fk: true,
    first_settlement_reversal_leg_fk: true,
    first_settlement_reversal_columns: true,
    first_settlement_leg_transfer_id: true,
    first_source_type_absent: true,
    first_new_columns_absent: true,
    first_source_index_absent: true,
    first_anon_role: true,
    first_authenticated_role: true,
    ...overrides,
  };
}

function firstSchema(overrides = {}) {
  return {
    first_source_type_enum: true,
    first_requested_amount: true,
    first_successfully_reversed_amount: true,
    first_source_type_column: true,
    first_stripe_source_object_id: true,
    first_original_transfer_id: true,
    first_requested_amount_check: true,
    first_successfully_reversed_amount_check: true,
    first_source_index: true,
    ...overrides,
  };
}

function secondPreflight(overrides = {}) {
  return {
    second_status_enum: true,
    second_status_values_absent: true,
    second_manual_requeue_count_absent: true,
    second_status_constraint: true,
    second_reversal_locked_at: true,
    second_status_index_absent: true,
    second_manual_requeue_check_absent: true,
    ...overrides,
  };
}

function secondSchema(overrides = {}) {
  return {
    second_status_values: true,
    second_manual_requeue_count: true,
    second_manual_requeue_check: true,
    second_status_index: true,
    second_status_constraint: true,
    second_rls: true,
    second_public_access_revoked: true,
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

const localMigrations = readLocalMigrationNames();
const historicalMigrationNames = localMigrations.filter(
  (migrationName) => ![FIRST_APPROVED_MIGRATION, TARGET_MIGRATION].includes(migrationName),
);
const historicalRecords = historicalMigrationNames.map((migrationName) => (
  LEGACY_ZERO_STEP_MIGRATIONS.includes(migrationName)
    ? zeroStepRecord(migrationName)
    : record(migrationName)
));
const appliedFirst = record(FIRST_APPROVED_MIGRATION);
const appliedTarget = record(TARGET_MIGRATION);

function initialDeploymentResponses(afterRecords = [
  ...historicalRecords,
  appliedFirst,
  appliedTarget,
]) {
  return [
    historicalRecords,
    [legacySchemaEvidence()],
    [prerequisiteSchema()],
    [releaseApprovalSchema()],
    [firstPreflight()],
    [secondPreflight()],
    afterRecords,
    [prerequisiteSchema()],
    [releaseApprovalSchema()],
    [firstSchema()],
    [secondSchema()],
  ];
}

function recoveryResponses(afterRecords = [
  ...historicalRecords,
  appliedFirst,
  appliedTarget,
]) {
  return [
    [...historicalRecords, appliedFirst],
    [legacySchemaEvidence()],
    [prerequisiteSchema()],
    [releaseApprovalSchema()],
    [firstSchema()],
    [secondPreflight()],
    afterRecords,
    [prerequisiteSchema()],
    [releaseApprovalSchema()],
    [firstSchema()],
    [secondSchema()],
  ];
}

function completedResponses() {
  return [
    [...historicalRecords, appliedFirst, appliedTarget],
    [legacySchemaEvidence()],
    [prerequisiteSchema()],
    [releaseApprovalSchema()],
    [firstSchema()],
    [secondSchema()],
  ];
}

async function assertDiagnostic(promise, expected) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ProductionMigrationDiagnostic);
    assert.equal(error.stage, expected.stage);
    assert.equal(error.source, expected.source);
    assert.equal(error.code, expected.code ?? "unknown");
    return true;
  });
}

function productionOptions(fake, overrides = {}) {
  return {
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    ...overrides,
  };
}

test("local and Preview builds skip without opening a database connection", async () => {
  let connections = 0;
  const createClient = () => {
    connections += 1;
    throw new Error("must not connect");
  };

  assert.equal(await runProductionMigrations({ environment: {}, createClient }), "skipped");
  assert.equal(await runProductionMigrations({
    environment: { VERCEL_ENV: "preview" },
    createClient,
  }), "skipped");
  assert.equal(connections, 0);
});

test("the approved migration batch is exact and the accepted pending states are explicit", () => {
  assert.deepEqual(APPROVED_PRODUCTION_MIGRATION_BATCH, [
    "20260718100000_add_settlement_transfer_reversals",
    "20260718110000_harden_settlement_reversal_states",
  ]);
});

test("missing or malformed Production URLs identify environment or identity validation", async () => {
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production" },
  }), { stage: "environment_validation", source: "none" });
  await assertDiagnostic(runProductionMigrations({
    environment: { VERCEL_ENV: "production", DATABASE_URL: "not-a-database-url" },
  }), { stage: "connection_identity_validation", source: "DATABASE_URL" });
});

test("Supabase verification accepts only the exact direct host or pooler username", () => {
  assert.equal(isExpectedSupabaseConnection(directUrl), true);
  assert.equal(isExpectedSupabaseConnection(poolerUrl), true);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:placeholder@db.other.supabase.co/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres.cjryteuoyiiwsxarblfd.evil:placeholder@host/postgres"), false);
  assert.equal(isExpectedSupabaseConnection("postgresql://postgres:placeholder@db.cjryteuoyiiwsxarblfd.evil/postgres"), false);
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
  }), { stage: "database_connection", source: "DIRECT_URL", code: "ECONNREFUSED" });
});

test("both approved migrations pending deploy successfully with all post-checks", async () => {
  const fake = fakeClient(initialDeploymentResponses());
  let deploys = 0;
  const result = await runProductionMigrations(productionOptions(fake, {
    deploy: () => { deploys += 1; },
  }));
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.equal(fake.calls.end, 1);
  assert.equal(fake.calls.query, 11);
});

test("only the second approved migration pending is a valid recovery state", async () => {
  const fake = fakeClient(recoveryResponses());
  let deploys = 0;
  const result = await runProductionMigrations(productionOptions(fake, {
    deploy: () => { deploys += 1; },
  }));
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.equal(fake.calls.query, 11);
  assert.equal(fake.calls.end, 1);
});

test("completed deployment verifies both migrations and skips Prisma", async () => {
  const fake = fakeClient(completedResponses());
  let deploys = 0;
  const result = await runProductionMigrations(productionOptions(fake, {
    deploy: () => { deploys += 1; },
  }));
  assert.equal(result, "already-applied");
  assert.equal(deploys, 0);
  assert.equal(fake.calls.query, 6);
  assert.equal(fake.calls.end, 1);
});

test("only the first pending, reversed order, extra, or missing historical migration is rejected", async () => {
  const cases = [
    {
      records: [...historicalRecords, appliedTarget],
      localNames: localMigrations,
    },
    {
      records: historicalRecords,
      localNames: [...localMigrations].toSpliced(
        localMigrations.indexOf(FIRST_APPROVED_MIGRATION),
        2,
        TARGET_MIGRATION,
        FIRST_APPROVED_MIGRATION,
      ),
    },
    {
      records: historicalRecords,
      localNames: [...localMigrations, "20260718120000_unapproved_migration"],
    },
    {
      records: historicalRecords.filter((recordEntry) => recordEntry.migration_name !== RELEASE_APPROVAL_MIGRATION),
      localNames: localMigrations,
    },
  ];

  for (const { records, localNames } of cases) {
    const fake = fakeClient([records, [legacySchemaEvidence()]]);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      localMigrationNames: localNames,
    })), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "pending_set_mismatch",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("failed, rolled-back, duplicate, and unknown Production history fails closed", async () => {
  for (const invalidRecord of [
    record(FIRST_APPROVED_MIGRATION, { finished_at: null }),
    record(FIRST_APPROVED_MIGRATION, { rolled_back_at: new Date("2026-07-17T00:00:00.000Z") }),
    record(FIRST_APPROVED_MIGRATION, { applied_steps_count: 0 }),
  ]) {
    const fake = fakeClient([[...historicalRecords, invalidRecord]]);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "unknown",
    });
    assert.equal(fake.calls.end, 1);
  }

  const duplicate = fakeClient([[...historicalRecords, appliedFirst, appliedFirst]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(duplicate)), {
    stage: "migration_state_evaluation",
    source: "DIRECT_URL",
  });
  assert.equal(duplicate.calls.end, 1);
});

test("first migration preflight fails closed for each required evidence field", async () => {
  const keys = [
    "first_settlement_reversal_table",
    "first_settlement_leg_table",
    "first_settlement_reversal_settlement_fk",
    "first_settlement_reversal_leg_fk",
    "first_settlement_reversal_columns",
    "first_settlement_leg_transfer_id",
    "first_source_type_absent",
    "first_new_columns_absent",
    "first_source_index_absent",
    "first_anon_role",
    "first_authenticated_role",
  ];

  for (const key of keys) {
    const responses = initialDeploymentResponses();
    responses[4] = [firstPreflight({ [key]: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake)), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "target_preflight_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("second migration preflight fails closed for each required evidence field", async () => {
  const keys = [
    "second_status_enum",
    "second_status_values_absent",
    "second_manual_requeue_count_absent",
    "second_status_constraint",
    "second_reversal_locked_at",
    "second_status_index_absent",
    "second_manual_requeue_check_absent",
  ];

  for (const key of keys) {
    const responses = initialDeploymentResponses();
    responses[5] = [secondPreflight({ [key]: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake)), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "target_preflight_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("recovery preflight requires complete first-migration schema", async () => {
  const responses = recoveryResponses();
  responses[4] = [firstSchema({ first_source_index: false })];
  const fake = fakeClient(responses);
  await assertDiagnostic(runProductionMigrations(productionOptions(fake)), {
    stage: "migration_state_evaluation",
    source: "DIRECT_URL",
    code: "target_preflight_failed",
  });
  assert.equal(fake.calls.end, 1);
});

test("first and second migration post-verification failures fail closed", async () => {
  for (const [index, expectedCode] of [
    [9, "target_postverify_failed"],
    [10, "target_postverify_failed"],
  ]) {
    const responses = initialDeploymentResponses();
    responses[index] = [index === 9
      ? firstSchema({ first_successfully_reversed_amount_check: false })
      : secondSchema({ second_status_index: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "target_verification",
      source: "DIRECT_URL",
      code: expectedCode,
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("both migration records require exactly one applied step", async () => {
  for (const migrationName of [
    FIRST_APPROVED_MIGRATION,
    TARGET_MIGRATION,
  ]) {
    const afterRecords = [...historicalRecords, record(FIRST_APPROVED_MIGRATION), record(TARGET_MIGRATION)];
    afterRecords[afterRecords.findIndex((entry) => entry.migration_name === migrationName)] = zeroStepRecord(migrationName);
    const fake = fakeClient(initialDeploymentResponses(afterRecords));
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "target_verification",
      source: "DIRECT_URL",
      code: "target_postverify_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("the exact legacy zero-step allowlist remains supported with evidence", async () => {
  assert.deepEqual(LEGACY_ZERO_STEP_MIGRATIONS, [
    "20260626010000_add_deal_progress_statuses",
    "20260627010000_add_buyer_preferred_supplier_type",
    "20260627020000_add_message_attachments",
    "20260627030000_add_rich_product_fields",
  ]);

  for (const legacyMigration of LEGACY_ZERO_STEP_MIGRATIONS) {
    const localNames = localMigrations;
    const beforeRecords = historicalRecords;
    assert.ok(beforeRecords.some((entry) => entry.migration_name === legacyMigration));
    const responses = [
      beforeRecords,
      [legacySchemaEvidence()],
      [prerequisiteSchema()],
      [releaseApprovalSchema()],
      [firstPreflight()],
      [secondPreflight()],
      [...beforeRecords, appliedFirst, appliedTarget],
      [prerequisiteSchema()],
      [releaseApprovalSchema()],
      [firstSchema()],
      [secondSchema()],
    ];
    const fake = fakeClient(responses);
    const result = await runProductionMigrations(productionOptions(fake, {
      localMigrationNames: localNames,
      deploy: () => {},
    }));
    assert.equal(result, "deployed");
    assert.equal(fake.calls.end, 1);
  }
});

test("unknown zero-step migration and invalid legacy evidence fail closed", async () => {
  const unknown = "20260628010000_unknown_zero_step_migration";
  const unknownFake = fakeClient([[zeroStepRecord(unknown)]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(unknownFake, {
    localMigrationNames: [...localMigrations, unknown].sort(),
  })), { stage: "migration_state_evaluation", source: "DIRECT_URL" });

  const evidenceFake = fakeClient([
    historicalRecords,
    [legacySchemaEvidence({ deal_status_in_progress: false })],
  ]);
  await assertDiagnostic(runProductionMigrations(productionOptions(evidenceFake, {
    localMigrationNames: localMigrations,
  })), { stage: "migration_state_evaluation", source: "DIRECT_URL" });
});

test("Prisma subprocess failures identify prisma_migrate_deploy", async () => {
  const fake = fakeClient(initialDeploymentResponses());
  const error = new Error("subprocess output must not escape");
  error.code = "subprocess_exit_1";
  await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
    deploy: () => { throw error; },
  })), {
    stage: "prisma_migrate_deploy",
    source: "DIRECT_URL",
    code: "subprocess_exit_1",
  });
  assert.equal(fake.calls.end, 1);
});

test("diagnostics contain only fixed fields and never connection data", () => {
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
});
