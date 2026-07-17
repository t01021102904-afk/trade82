import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

export const PRODUCTION_ENVIRONMENT = "production";
export const EXPECTED_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
export const PREREQUISITE_MIGRATION = "20260716150000_add_partner_program_referral_claims";
export const TARGET_MIGRATION = "20260717120000_add_settlement_release_approval";
export const LEGACY_ZERO_STEP_MIGRATIONS = Object.freeze([
  "20260626010000_add_deal_progress_statuses",
  "20260627010000_add_buyer_preferred_supplier_type",
  "20260627020000_add_message_attachments",
  "20260627030000_add_rich_product_fields",
]);

const MIGRATION_DIRECTORY = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
const SAFE_ERROR_CODES = new Set([
  "ENETUNREACH",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ECONNRESET",
  "28P01",
  "3D000",
  "42P01",
  "subprocess_exit_1",
  "pending_set_mismatch",
  "prerequisite_preflight_failed",
  "target_preflight_failed",
  "prerequisite_postverify_failed",
  "target_postverify_failed",
  "unknown",
]);

export const STAGES = Object.freeze([
  "environment_validation",
  "connection_identity_validation",
  "database_connection",
  "migration_history_before",
  "migration_state_evaluation",
  "prisma_migrate_deploy",
  "migration_history_after",
  "target_verification",
]);

const SOURCES = new Set(["DIRECT_URL", "DATABASE_URL", "none"]);

export class ProductionMigrationDiagnostic extends Error {
  constructor(stage, source, code = "unknown") {
    super("Production migration diagnostic");
    this.name = "ProductionMigrationDiagnostic";
    this.stage = STAGES.includes(stage) ? stage : "target_verification";
    this.source = SOURCES.has(source) ? source : "none";
    this.code = SAFE_ERROR_CODES.has(code) ? code : "unknown";
  }
}

export function getConnectionSource(environment) {
  if (environment.DIRECT_URL !== undefined && environment.DIRECT_URL !== null) {
    return "DIRECT_URL";
  }
  if (environment.DATABASE_URL !== undefined && environment.DATABASE_URL !== null) {
    return "DATABASE_URL";
  }
  return "none";
}

export function getSafeErrorCode(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "unknown";
  return SAFE_ERROR_CODES.has(code) ? code : "unknown";
}

export function formatDiagnostic(error) {
  const diagnostic = error instanceof ProductionMigrationDiagnostic
    ? error
    : new ProductionMigrationDiagnostic("target_verification", "none", getSafeErrorCode(error));
  return [
    `[production-migration] failed stage=${diagnostic.stage}`,
    `source=${diagnostic.source}`,
    `code=${diagnostic.code}`,
  ].join("\n");
}

export function isExpectedSupabaseConnection(connectionString) {
  try {
    const parsedUrl = new URL(connectionString);
    if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
      return false;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const username = decodeURIComponent(parsedUrl.username).toLowerCase();
    const directHost = `db.${EXPECTED_SUPABASE_PROJECT}.supabase.co`;
    const poolerUser = `postgres.${EXPECTED_SUPABASE_PROJECT}`;

    return hostname === directHost || username === poolerUser;
  } catch {
    return false;
  }
}

export function readLocalMigrationNames(directory = MIGRATION_DIRECTORY) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_[^/]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function hasLegacySchemaEvidence(migrationName, schemaEvidence) {
  if (!schemaEvidence) return false;

  const evidenceByMigration = {
    "20260626010000_add_deal_progress_statuses": [
      "deal_status_in_progress",
      "deal_status_completion_requested",
    ],
    "20260627010000_add_buyer_preferred_supplier_type": [
      "buyer_preferred_supplier_type",
    ],
    "20260627020000_add_message_attachments": [
      "message_attachment_table",
      "message_content_hash",
      "message_attachment_file_type",
      "message_attachment_status",
    ],
    "20260627030000_add_rich_product_fields": [
      "product_price_unit",
      "product_moq_quantity",
      "product_incoterms",
      "product_suggested_us_channels",
    ],
  };

  return (evidenceByMigration[migrationName] ?? []).every(
    (key) => schemaEvidence[key] === true,
  );
}

function isSuccessfulMigrationRecord(record, schemaEvidence) {
  if (record.finished_at === null || record.rolled_back_at !== null) {
    return false;
  }

  const appliedSteps = Number(record.applied_steps_count);
  return appliedSteps >= 1
    || (appliedSteps === 0
      && LEGACY_ZERO_STEP_MIGRATIONS.includes(record.migration_name)
      && hasLegacySchemaEvidence(record.migration_name, schemaEvidence));
}

const INITIAL_PENDING_MIGRATIONS = Object.freeze([
  PREREQUISITE_MIGRATION,
  TARGET_MIGRATION,
]);
const RECOVERY_PENDING_MIGRATIONS = Object.freeze([TARGET_MIGRATION]);

function hasExactMigrationList(actual, expected) {
  return actual.length === expected.length
    && actual.every((migrationName, index) => migrationName === expected[index]);
}

function migrationState(localMigrationNames, databaseRecords, schemaEvidence) {
  const localNames = new Set(localMigrationNames);
  const databaseNames = new Set();

  if (localNames.size !== localMigrationNames.length) {
    const error = new Error("Local migration history contains duplicate names.");
    error.code = "pending_set_mismatch";
    throw error;
  }

  for (const record of databaseRecords) {
    if (typeof record.migration_name !== "string" || databaseNames.has(record.migration_name)) {
      throw new Error("Production migration history is invalid.");
    }
    databaseNames.add(record.migration_name);

    if (!isSuccessfulMigrationRecord(record, schemaEvidence)) {
      throw new Error("Production migration history contains a failed migration.");
    }
    if (!localNames.has(record.migration_name)) {
      throw new Error("Production migration history diverges from the application.");
    }
  }

  if (!localNames.has(TARGET_MIGRATION)) {
    throw new Error("The allowlisted production migration is missing locally.");
  }

  const pendingMigrations = localMigrationNames.filter((name) => !databaseNames.has(name));

  if (pendingMigrations.length === 0) {
    if (!databaseNames.has(PREREQUISITE_MIGRATION) || !databaseNames.has(TARGET_MIGRATION)) {
      const error = new Error("The allowlisted production migration is not recorded.");
      error.code = "pending_set_mismatch";
      throw error;
    }
    return { action: "skip", pendingMigrations };
  }

  if (!hasExactMigrationList(pendingMigrations, INITIAL_PENDING_MIGRATIONS)
    && !hasExactMigrationList(pendingMigrations, RECOVERY_PENDING_MIGRATIONS)) {
    const error = new Error("Production has an unexpected pending migration.");
    error.code = "pending_set_mismatch";
    throw error;
  }

  return { action: "deploy", pendingMigrations };
}

function assertMigrationApplied(databaseRecords, migrationName) {
  const migrationRecords = databaseRecords.filter((record) => record.migration_name === migrationName);
  if (migrationRecords.length !== 1) {
    throw new Error("The required production migration was not applied exactly once.");
  }

  const [migration] = migrationRecords;
  if (migration.finished_at === null
    || migration.rolled_back_at !== null
    || Number(migration.applied_steps_count) !== 1) {
    throw new Error("The required production migration failed verification.");
  }
}

async function queryMigrationRecords(client) {
  const result = await client.query(`
    SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM "_prisma_migrations"
    ORDER BY started_at, migration_name
  `);
  return result.rows;
}

async function queryLegacySchemaEvidence(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'DealStatus'
          AND pg_enum.enumlabel = 'in_progress'
      ) AS deal_status_in_progress,
      EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'DealStatus'
          AND pg_enum.enumlabel = 'completion_requested'
      ) AS deal_status_completion_requested,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'BuyerProfile'
          AND column_name = 'preferredSupplierType'
      ) AS buyer_preferred_supplier_type,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'MessageAttachment'
      ) AS message_attachment_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Message'
          AND column_name = 'contentHash'
      ) AS message_content_hash,
      EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'MessageAttachmentFileType'
      ) AS message_attachment_file_type,
      EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'MessageAttachmentStatus'
      ) AS message_attachment_status,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'priceUnit'
      ) AS product_price_unit,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'moqQuantity'
      ) AS product_moq_quantity,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'incoterms'
      ) AS product_incoterms,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'suggestedUsChannels'
      ) AS product_suggested_us_channels
  `);
  return result.rows[0] ?? null;
}

async function queryPrerequisitePreflight(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'PartnerProfile'
      ) AS partner_profile_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PartnerProfile'
          AND column_name = 'id'
          AND data_type = 'text'
      ) AS partner_profile_id_text,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'UserProfile'
      ) AS user_profile_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND column_name = 'id'
          AND data_type = 'text'
      ) AS user_profile_id_text,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS anon_role,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS authenticated_role,
      NOT EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname LIKE 'ReferralClaimToken%'
          AND pg_class.relkind IN ('r', 'p', 'i', 'S', 'v', 'm', 'f')
      ) AS referral_claim_token_relations_absent,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ReferralClaimToken'
      ) AS referral_claim_token_columns_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname LIKE 'ReferralClaimToken%'
          AND pg_class.relkind = 'i'
      ) AS referral_claim_token_indexes_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname LIKE 'ReferralClaimToken%'
      ) AS referral_claim_token_constraints_absent
  `);
  return result.rows[0] ?? null;
}

async function queryPrerequisiteSchema(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ReferralClaimToken'
      ) AS referral_claim_token_table,
      (
        SELECT relrowsecurity
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken'
          AND pg_class.relkind IN ('r', 'p')
      ) IS TRUE AS referral_claim_token_rls,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken'
          AND pg_constraint.conname = 'ReferralClaimToken_pkey'
          AND pg_constraint.contype = 'p'
      ) AS referral_claim_token_primary_key,
      (
        SELECT count(*) = 7
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ReferralClaimToken'
          AND column_name IN (
            'id', 'tokenHash', 'partnerProfileId', 'expiresAt',
            'consumedAt', 'consumedByUserId', 'createdAt'
          )
      ) AS referral_claim_token_columns,
      EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken_tokenHash_key'
          AND pg_class.relkind = 'i'
          AND pg_class.relam IS NOT NULL
      ) AS referral_claim_token_hash_index,
      EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken_partnerProfileId_expiresAt_idx'
          AND pg_class.relkind = 'i'
      ) AS referral_claim_token_partner_index,
      EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken_consumedByUserId_createdAt_idx'
          AND pg_class.relkind = 'i'
      ) AS referral_claim_token_consumed_index,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken'
          AND pg_constraint.conname = 'ReferralClaimToken_partnerProfileId_fkey'
          AND pg_constraint.contype = 'f'
      ) AS referral_claim_token_partner_fk,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'ReferralClaimToken'
          AND pg_constraint.conname = 'ReferralClaimToken_consumedByUserId_fkey'
          AND pg_constraint.contype = 'f'
      ) AS referral_claim_token_consumed_fk,
      NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'SELECT')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'INSERT')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'UPDATE')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'DELETE')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'TRUNCATE')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'REFERENCES')
        AND NOT has_table_privilege('anon', 'public."ReferralClaimToken"', 'TRIGGER')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'DELETE')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'TRUNCATE')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'REFERENCES')
        AND NOT has_table_privilege('authenticated', 'public."ReferralClaimToken"', 'TRIGGER')
        AS referral_claim_token_public_access_revoked
  `);
  return result.rows[0] ?? null;
}

async function queryTargetPreflight(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 4
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('Settlement', 'SettlementLeg', 'SettlementReversal', 'SettlementEvent')
      ) AS target_prerequisite_tables,
      NOT EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'SettlementEventType'
          AND pg_enum.enumlabel IN ('ADMIN_APPROVED', 'ADMIN_HELD', 'ADMIN_REEVALUATED')
      ) AS target_enum_values_absent,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'Settlement' AND column_name IN ('approvedAt', 'approvedByUserId', 'holdReason'))
            OR (table_name = 'SettlementLeg' AND column_name IN (
              'transferAttemptCount', 'nextTransferAttemptAt', 'transferLastError',
              'transferLockedAt', 'transferredAt'
            ))
            OR (table_name = 'SettlementReversal' AND column_name IN (
              'reversalAttemptCount', 'nextReversalAttemptAt', 'reversalLastError',
              'reversalLockedAt', 'completedAt'
            ))
          )
      ) AS target_columns_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname IN (
            'Settlement_approval_hold_reason_check',
            'SettlementLeg_transfer_retry_check',
            'SettlementReversal_retry_check',
            'Settlement_approvedByUserId_fkey'
          )
      ) AS target_constraints_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname IN (
            'Settlement_approvedByUserId_idx',
            'SettlementLeg_status_holdUntil_idx',
            'SettlementLeg_status_nextTransferAttemptAt_idx',
            'SettlementReversal_status_nextReversalAttemptAt_idx'
          )
          AND pg_class.relkind = 'i'
      ) AS target_indexes_absent
  `);
  return result.rows[0] ?? null;
}

async function queryTargetSchema(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 3
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'SettlementEventType'
          AND pg_enum.enumlabel IN ('ADMIN_APPROVED', 'ADMIN_HELD', 'ADMIN_REEVALUATED')
      ) AS target_enum_values,
      (
        SELECT count(*) = 13
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'Settlement' AND column_name IN ('approvedAt', 'approvedByUserId', 'holdReason'))
            OR (table_name = 'SettlementLeg' AND column_name IN (
              'transferAttemptCount', 'nextTransferAttemptAt', 'transferLastError',
              'transferLockedAt', 'transferredAt'
            ))
            OR (table_name = 'SettlementReversal' AND column_name IN (
              'reversalAttemptCount', 'nextReversalAttemptAt', 'reversalLastError',
              'reversalLockedAt', 'completedAt'
            ))
          )
      ) AS target_columns,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname = 'Settlement_approval_hold_reason_check'
          AND pg_constraint.contype = 'c'
      ) AS target_hold_reason_check,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname = 'SettlementLeg_transfer_retry_check'
          AND pg_constraint.contype = 'c'
      ) AS target_leg_retry_check,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname = 'SettlementReversal_retry_check'
          AND pg_constraint.contype = 'c'
      ) AS target_reversal_retry_check,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_constraint.conname = 'Settlement_approvedByUserId_fkey'
          AND pg_constraint.contype = 'f'
      ) AS target_approval_fk,
      (
        SELECT count(*) = 4
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname IN (
            'Settlement_approvedByUserId_idx',
            'SettlementLeg_status_holdUntil_idx',
            'SettlementLeg_status_nextTransferAttemptAt_idx',
            'SettlementReversal_status_nextReversalAttemptAt_idx'
          )
          AND pg_class.relkind = 'i'
      ) AS target_indexes
  `);
  return result.rows[0] ?? null;
}

function allEvidencePresent(evidence, keys) {
  return Boolean(evidence) && keys.every((key) => evidence[key] === true);
}

const PREREQUISITE_PREFLIGHT_KEYS = [
  "partner_profile_table",
  "partner_profile_id_text",
  "user_profile_table",
  "user_profile_id_text",
  "anon_role",
  "authenticated_role",
  "referral_claim_token_relations_absent",
  "referral_claim_token_columns_absent",
  "referral_claim_token_indexes_absent",
  "referral_claim_token_constraints_absent",
];

const PREREQUISITE_SCHEMA_KEYS = [
  "referral_claim_token_table",
  "referral_claim_token_rls",
  "referral_claim_token_primary_key",
  "referral_claim_token_columns",
  "referral_claim_token_hash_index",
  "referral_claim_token_partner_index",
  "referral_claim_token_consumed_index",
  "referral_claim_token_partner_fk",
  "referral_claim_token_consumed_fk",
  "referral_claim_token_public_access_revoked",
];

const TARGET_PREFLIGHT_KEYS = [
  "target_prerequisite_tables",
  "target_enum_values_absent",
  "target_columns_absent",
  "target_constraints_absent",
  "target_indexes_absent",
];

const TARGET_SCHEMA_KEYS = [
  "target_enum_values",
  "target_columns",
  "target_hold_reason_check",
  "target_leg_retry_check",
  "target_reversal_retry_check",
  "target_approval_fk",
  "target_indexes",
];

function createProductionClient(connectionString) {
  return new Client({ connectionString });
}

function deployCommittedMigrations(environment) {
  try {
    execFileSync("npm", ["run", "db:deploy"], {
      env: environment,
      stdio: "ignore",
    });
  } catch {
    const error = new Error("Prisma migration subprocess failed");
    error.code = "subprocess_exit_1";
    throw error;
  }
}

export async function runProductionMigrations({
  environment = process.env,
  createClient = createProductionClient,
  localMigrationNames,
  deploy = deployCommittedMigrations,
} = {}) {
  if (environment.VERCEL_ENV !== PRODUCTION_ENVIRONMENT) {
    return "skipped";
  }

  const source = getConnectionSource(environment);
  let connectionString;

  if (source === "none") {
    throw new ProductionMigrationDiagnostic("environment_validation", source);
  }

  connectionString = environment[source];
  if (typeof connectionString !== "string" || connectionString.length === 0) {
    throw new ProductionMigrationDiagnostic("connection_identity_validation", source);
  }
  if (!isExpectedSupabaseConnection(connectionString)) {
    throw new ProductionMigrationDiagnostic("connection_identity_validation", source);
  }

  let client;
  try {
    try {
      client = createClient(connectionString);
      await client.connect();
    } catch (error) {
      throw new ProductionMigrationDiagnostic("database_connection", source, getSafeErrorCode(error));
    }

    let beforeRecords;
    try {
      beforeRecords = await queryMigrationRecords(client);
    } catch (error) {
      throw new ProductionMigrationDiagnostic("migration_history_before", source, getSafeErrorCode(error));
    }

    let schemaEvidence = null;
    if (beforeRecords.some((record) => (
      record.finished_at !== null
      && record.rolled_back_at === null
      && Number(record.applied_steps_count) === 0
    ))) {
      try {
        schemaEvidence = await queryLegacySchemaEvidence(client);
      } catch (error) {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          getSafeErrorCode(error),
        );
      }
    }

    let state;
    const localNames = localMigrationNames ?? readLocalMigrationNames();
    try {
      state = migrationState(
        localNames,
        beforeRecords,
        schemaEvidence,
      );
    } catch (error) {
      throw new ProductionMigrationDiagnostic(
        "migration_state_evaluation",
        source,
        getSafeErrorCode(error) === "pending_set_mismatch" ? "pending_set_mismatch" : "unknown",
      );
    }

    if (state.action === "skip") {
      try {
        assertMigrationApplied(beforeRecords, PREREQUISITE_MIGRATION);
        const prerequisiteSchema = await queryPrerequisiteSchema(client);
        if (!allEvidencePresent(prerequisiteSchema, PREREQUISITE_SCHEMA_KEYS)) {
          throw new Error("Prerequisite schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "prerequisite_preflight_failed",
        );
      }

      try {
        assertMigrationApplied(beforeRecords, TARGET_MIGRATION);
        const targetSchema = await queryTargetSchema(client);
        if (!allEvidencePresent(targetSchema, TARGET_SCHEMA_KEYS)) {
          throw new Error("Target schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
      return "already-applied";
    }

    if (state.pendingMigrations.includes(PREREQUISITE_MIGRATION)) {
      try {
        const prerequisitePreflight = await queryPrerequisitePreflight(client);
        if (!allEvidencePresent(prerequisitePreflight, PREREQUISITE_PREFLIGHT_KEYS)) {
          throw new Error("Prerequisite preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "prerequisite_preflight_failed",
        );
      }
    } else {
      try {
        assertMigrationApplied(beforeRecords, PREREQUISITE_MIGRATION);
        const prerequisiteSchema = await queryPrerequisiteSchema(client);
        if (!allEvidencePresent(prerequisiteSchema, PREREQUISITE_SCHEMA_KEYS)) {
          throw new Error("Prerequisite schema preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "prerequisite_preflight_failed",
        );
      }
    }

    try {
      if (beforeRecords.some((record) => record.migration_name === TARGET_MIGRATION)) {
        throw new Error("Target migration record must be absent before deployment.");
      }
      const targetPreflight = await queryTargetPreflight(client);
      if (!allEvidencePresent(targetPreflight, TARGET_PREFLIGHT_KEYS)) {
        throw new Error("Target preflight failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "migration_state_evaluation",
        source,
        "target_preflight_failed",
      );
    }

    try {
      deploy(environment);
    } catch (error) {
      if (error instanceof ProductionMigrationDiagnostic) throw error;
      throw new ProductionMigrationDiagnostic("prisma_migrate_deploy", source, getSafeErrorCode(error));
    }

    let afterRecords;
    try {
      afterRecords = await queryMigrationRecords(client);
    } catch (error) {
      throw new ProductionMigrationDiagnostic("migration_history_after", source, getSafeErrorCode(error));
    }

    try {
      assertMigrationApplied(afterRecords, PREREQUISITE_MIGRATION);
      const prerequisiteSchema = await queryPrerequisiteSchema(client);
      if (!allEvidencePresent(prerequisiteSchema, PREREQUISITE_SCHEMA_KEYS)) {
        throw new Error("Prerequisite post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "prerequisite_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, TARGET_MIGRATION);
      const targetSchema = await queryTargetSchema(client);
      if (!allEvidencePresent(targetSchema, TARGET_SCHEMA_KEYS)) {
        throw new Error("Target post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "target_postverify_failed",
      );
    }
    return "deployed";
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runProductionMigrations();
    if (result === "skipped") {
      console.log("Production database migrations skipped.");
    } else if (result === "already-applied") {
      console.log("Allowlisted production database migration already applied.");
    } else {
      console.log("Allowlisted production database migration applied.");
    }
  } catch (error) {
    console.error(formatDiagnostic(error));
    process.exitCode = 1;
  }
}
