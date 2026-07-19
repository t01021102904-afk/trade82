import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APPROVED_PRODUCTION_MIGRATION_BATCH,
  EXPECTED_SUPABASE_PROJECT,
  FIRST_APPROVED_MIGRATION,
  LEGACY_ZERO_STEP_MIGRATIONS,
  MERCHANT_MIGRATION,
  OPERATIONS_MIGRATION,
  ProductionMigrationDiagnostic,
  TARGET_MIGRATION,
  formatDiagnostic,
  getConnectionSource,
  isExpectedSupabaseConnection,
  readLocalMigrationNames,
  runProductionMigrations,
} from "../scripts/run-production-migrations.mjs";

const directUrl = `postgresql://postgres:credential-placeholder@db.${EXPECTED_SUPABASE_PROJECT}.supabase.co:5432/postgres`;
const poolerUrl = `postgresql://postgres.${EXPECTED_SUPABASE_PROJECT}:credential-placeholder@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
const localMigrations = readLocalMigrationNames();
const approvedNames = new Set([...APPROVED_PRODUCTION_MIGRATION_BATCH, OPERATIONS_MIGRATION]);
const historicalMigrationNames = localMigrations.filter((name) => !approvedNames.has(name));

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

const historicalRecords = historicalMigrationNames.map((name) => (
  LEGACY_ZERO_STEP_MIGRATIONS.includes(name) ? zeroStepRecord(name) : record(name)
));
const appliedFirst = record(FIRST_APPROVED_MIGRATION);
const appliedTarget = record(TARGET_MIGRATION);
const appliedMerchant = record(MERCHANT_MIGRATION);
const appliedOperations = record(OPERATIONS_MIGRATION);

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

function targetSchema(overrides = {}) {
  return {
    target_enum_values: true,
    target_event_type_enum: true,
    target_user_profile_table: true,
    target_user_profile_id_text: true,
    target_user_profile_id_key: true,
    target_settlement_leg_status: true,
    target_settlement_leg_hold_until: true,
    target_settlement_reversal_status: true,
    target_columns: true,
    target_hold_reason_check: true,
    target_leg_retry_check: true,
    target_reversal_retry_check: true,
    target_approval_fk: true,
    target_indexes: true,
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

function merchantPreflight(overrides = {}) {
  return {
    merchant_company_table: true,
    merchant_company_id_text: true,
    merchant_company_id_key: true,
    merchant_table_absent: true,
    merchant_status_enum_absent: true,
    merchant_company_index_absent: true,
    merchant_stripe_index_absent: true,
    merchant_status_index_absent: true,
    merchant_company_fk_absent: true,
    merchant_anon_role: true,
    merchant_authenticated_role: true,
    ...overrides,
  };
}

function merchantSchema(overrides = {}) {
  return {
    merchant_status_enum: true,
    merchant_table: true,
    merchant_columns_total: true,
    merchant_columns_names: true,
    merchant_column_types: true,
    merchant_primary_key: true,
    merchant_company_unique: true,
    merchant_stripe_unique: true,
    merchant_status_index: true,
    merchant_company_fk_restrict: true,
    merchant_defaults: true,
    merchant_nullability: true,
    merchant_rls: true,
    merchant_public_access_revoked: true,
    ...overrides,
  };
}

function operationsPreflight(overrides = {}) {
  return {
    operations_payment_flow_absent: true,
    operations_leg_manual_review_absent: true,
    operations_tables_absent: true,
    operations_enum_types_absent: true,
    ...overrides,
  };
}

function operationsSchema(overrides = {}) {
  return {
    operations_enum_types: true,
    operations_enum_values: true,
    operations_payment_flow_column: true,
    operations_leg_manual_review: true,
    operations_tables: true,
    operations_worker_columns: true,
    operations_alert_columns: true,
    operations_indexes: true,
    operations_constraints: true,
    operations_restrictive_fks: true,
    operations_rls: true,
    operations_public_access_revoked: true,
    ...overrides,
  };
}

function operationsInitialState(overrides = {}) {
  return { operations_worker_run_zero_rows: true, operations_alert_zero_rows: true, ...overrides };
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

function productionOptions(fake, overrides = {}) {
  return {
    environment: { VERCEL_ENV: "production", DIRECT_URL: directUrl },
    createClient: () => fake.client,
    localMigrationNames: localMigrations,
    ...overrides,
  };
}

function deploymentResponses(afterRecords = [
  ...historicalRecords,
  appliedFirst,
  appliedTarget,
  appliedMerchant,
  appliedOperations,
]) {
  return [
    [...historicalRecords, appliedFirst, appliedTarget, appliedMerchant],
    [legacySchemaEvidence()],
    [prerequisiteSchema()],
    [targetSchema()],
    [firstSchema()],
    [secondSchema()],
    [merchantSchema()],
    [operationsPreflight()],
    afterRecords,
    [prerequisiteSchema()],
    [targetSchema()],
    [firstSchema()],
    [secondSchema()],
    [merchantSchema()],
    [operationsSchema()],
    [operationsInitialState()],
  ];
}

function completedResponses() {
  return [
    [...historicalRecords, appliedFirst, appliedTarget, appliedMerchant, appliedOperations],
    [legacySchemaEvidence()],
    [prerequisiteSchema()],
    [targetSchema()],
    [firstSchema()],
    [secondSchema()],
    [merchantSchema()],
    [operationsSchema()],
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

test("the approved batch is followed only by the operations migration", () => {
  assert.deepEqual(APPROVED_PRODUCTION_MIGRATION_BATCH, [
    "20260718100000_add_settlement_transfer_reversals",
    "20260718110000_harden_settlement_reversal_states",
    "20260718120000_add_seller_stripe_merchant_accounts",
  ]);
  assert.equal(localMigrations.at(-2), MERCHANT_MIGRATION);
  assert.equal(localMigrations.at(-1), OPERATIONS_MIGRATION);
});

test("missing or malformed Production URLs fail closed without connecting", async () => {
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

test("only approved migrations applied with operations pending runs the allowlisted migration", async () => {
  const fake = fakeClient(deploymentResponses());
  let deploys = 0;
  const result = await runProductionMigrations(productionOptions(fake, {
    deploy: () => { deploys += 1; },
  }));
  assert.equal(result, "deployed");
  assert.equal(deploys, 1);
  assert.equal(fake.calls.query, 16);
  assert.equal(fake.calls.end, 1);
});

test("all approved migrations applied skips Prisma after complete verification", async () => {
  const fake = fakeClient(completedResponses());
  let deploys = 0;
  const result = await runProductionMigrations(productionOptions(fake, {
    deploy: () => { deploys += 1; },
  }));
  assert.equal(result, "already-applied");
  assert.equal(deploys, 0);
  assert.equal(fake.calls.query, 8);
  assert.equal(fake.calls.end, 1);
});

test("old reversal states, reordered batches, missing history, and future migrations fail closed", async () => {
  const cases = [
    [...historicalRecords],
    [...historicalRecords, appliedFirst],
    [...historicalRecords, appliedTarget],
    [...historicalRecords, appliedFirst, appliedMerchant],
  ];
  for (const records of cases) {
    const fake = fakeClient([records, [legacySchemaEvidence()]]);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "migration_state_evaluation",
      source: "DIRECT_URL",
      code: "pending_set_mismatch",
    });
    assert.equal(fake.calls.end, 1);
  }

  const reordered = [...localMigrations].toSpliced(
    localMigrations.indexOf(FIRST_APPROVED_MIGRATION),
    2,
    TARGET_MIGRATION,
    FIRST_APPROVED_MIGRATION,
  );
  const reorderedFake = fakeClient([[...historicalRecords], [legacySchemaEvidence()]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(reorderedFake, {
    localMigrationNames: reordered,
  })), { stage: "migration_state_evaluation", source: "DIRECT_URL", code: "pending_set_mismatch" });

  const reorderedDatabase = fakeClient([
    [...historicalRecords, appliedTarget, appliedFirst, appliedMerchant],
    [legacySchemaEvidence()],
  ]);
  await assertDiagnostic(runProductionMigrations(productionOptions(reorderedDatabase)), {
    stage: "migration_state_evaluation", source: "DIRECT_URL", code: "pending_set_mismatch",
  });

  const futureNames = [...localMigrations, "20260718130000_future_migration"];
  const futureFake = fakeClient([[...historicalRecords, appliedFirst, appliedTarget, appliedMerchant], [legacySchemaEvidence()]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(futureFake, {
    localMigrationNames: futureNames,
  })), { stage: "migration_state_evaluation", source: "DIRECT_URL", code: "pending_set_mismatch" });
});

test("failed, rolled-back, duplicate, unknown, and target zero-step records fail closed", async () => {
  for (const invalidRecord of [
    record(FIRST_APPROVED_MIGRATION, { finished_at: null }),
    record(FIRST_APPROVED_MIGRATION, { rolled_back_at: new Date() }),
    zeroStepRecord(FIRST_APPROVED_MIGRATION),
    zeroStepRecord(MERCHANT_MIGRATION),
  ]) {
    const fake = fakeClient([[...historicalRecords, invalidRecord], [legacySchemaEvidence()]]);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake)), {
      stage: "migration_state_evaluation", source: "DIRECT_URL", code: "unknown",
    });
    assert.equal(fake.calls.end, 1);
  }

  const duplicate = fakeClient([[...historicalRecords, appliedFirst, appliedFirst]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(duplicate)), {
    stage: "migration_state_evaluation", source: "DIRECT_URL", code: "unknown",
  });
  assert.equal(duplicate.calls.end, 1);

  const unknown = fakeClient([[zeroStepRecord("20260718130000_unknown")]]);
  await assertDiagnostic(runProductionMigrations(productionOptions(unknown, {
    localMigrationNames: [...localMigrations, "20260718130000_unknown"].sort(),
  })), { stage: "migration_state_evaluation", source: "DIRECT_URL", code: "pending_set_mismatch" });
});

test("merchant preflight fails closed for each fixed evidence field", async () => {
  const keys = [
    "merchant_company_table",
    "merchant_company_id_text",
    "merchant_company_id_key",
    "merchant_table_absent",
    "merchant_status_enum_absent",
    "merchant_company_index_absent",
    "merchant_stripe_index_absent",
    "merchant_status_index_absent",
    "merchant_company_fk_absent",
    "merchant_anon_role",
    "merchant_authenticated_role",
  ];
  for (const key of keys) {
    const responses = deploymentResponses();
    responses[6] = [merchantPreflight({ [key]: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "migration_state_evaluation", source: "DIRECT_URL", code: "target_preflight_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("merchant post-verification fails closed for each schema field", async () => {
  const keys = [
    "merchant_status_enum",
    "merchant_table",
    "merchant_columns_total",
    "merchant_columns_names",
    "merchant_column_types",
    "merchant_primary_key",
    "merchant_company_unique",
    "merchant_stripe_unique",
    "merchant_status_index",
    "merchant_company_fk_restrict",
    "merchant_defaults",
    "merchant_nullability",
    "merchant_rls",
    "merchant_public_access_revoked",
  ];
  for (const key of keys) {
    const responses = deploymentResponses();
    responses[13] = [merchantSchema({ [key]: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "target_verification", source: "DIRECT_URL", code: "target_postverify_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("target preflight fails closed for each newly required dependency field", async () => {
  const keys = [
    "target_event_type_enum",
    "target_user_profile_table",
    "target_user_profile_id_text",
    "target_user_profile_id_key",
    "target_settlement_leg_status",
    "target_settlement_leg_hold_until",
    "target_settlement_reversal_status",
  ];
  for (const key of keys) {
    const responses = deploymentResponses();
    responses[3] = [targetSchema({ [key]: false })];
    const fake = fakeClient(responses);
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "migration_state_evaluation", source: "DIRECT_URL", code: "target_preflight_failed",
    });
    assert.equal(fake.calls.end, 1);
  }
});

test("operations deployment does not require merchant zero rows, while new operations rows fail initial-state verification", async () => {
  const responses = deploymentResponses();
  responses[15] = [operationsInitialState({ operations_worker_run_zero_rows: false })];
  const fake = fakeClient(responses);
  await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
    deploy: () => {},
  })), {
    stage: "target_verification", source: "DIRECT_URL", code: "target_postverify_failed",
  });

  const completed = fakeClient(completedResponses());
  assert.equal(await runProductionMigrations(productionOptions(completed)), "already-applied");
  assert.equal(completed.calls.query, 8);
});

test("legacy zero-step migrations remain accepted only with complete evidence", async () => {
  assert.deepEqual(LEGACY_ZERO_STEP_MIGRATIONS, [
    "20260626010000_add_deal_progress_statuses",
    "20260627010000_add_buyer_preferred_supplier_type",
    "20260627020000_add_message_attachments",
    "20260627030000_add_rich_product_fields",
  ]);

  const completed = fakeClient(completedResponses());
  assert.equal(await runProductionMigrations(productionOptions(completed)), "already-applied");

  const missingEvidence = fakeClient([
    [...historicalRecords, appliedFirst, appliedTarget, appliedMerchant],
    [legacySchemaEvidence({ deal_status_in_progress: false })],
  ]);
  await assertDiagnostic(runProductionMigrations(productionOptions(missingEvidence)), {
    stage: "migration_state_evaluation", source: "DIRECT_URL", code: "unknown",
  });
});

test("approved migrations require exactly one applied step after deploy", async () => {
  for (const migrationName of APPROVED_PRODUCTION_MIGRATION_BATCH) {
    const afterRecords = [...historicalRecords, appliedFirst, appliedTarget, appliedMerchant, appliedOperations];
    const index = afterRecords.findIndex((entry) => entry.migration_name === migrationName);
    afterRecords[index] = zeroStepRecord(migrationName);
    const fake = fakeClient(deploymentResponses(afterRecords));
    await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
      deploy: () => {},
    })), {
      stage: "target_verification", source: "DIRECT_URL", code: "target_postverify_failed",
    });
  }
});

test("Prisma subprocess failures identify prisma_migrate_deploy", async () => {
  const fake = fakeClient(deploymentResponses());
  const error = new Error("subprocess output must not escape");
  error.code = "subprocess_exit_1";
  await assertDiagnostic(runProductionMigrations(productionOptions(fake, {
    deploy: () => { throw error; },
  })), {
    stage: "prisma_migrate_deploy", source: "DIRECT_URL", code: "subprocess_exit_1",
  });
  assert.equal(fake.calls.end, 1);
});

test("diagnostics contain only fixed fields and never connection data", () => {
  const output = formatDiagnostic(new ProductionMigrationDiagnostic(
    "database_connection", "DIRECT_URL", "ECONNRESET",
  ));
  assert.equal(output, [
    "[production-migration] failed stage=database_connection",
    "source=DIRECT_URL",
    "code=ECONNRESET",
  ].join("\n"));
  assert.doesNotMatch(output, /cjryteuoyiiwsxarblfd\.supabase\.co/);
  assert.doesNotMatch(output, /credential-placeholder|postgres|password|secret/i);
});
