import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

export const PRODUCTION_ENVIRONMENT = "production";
export const EXPECTED_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
export const PREREQUISITE_MIGRATION = "20260716150000_add_partner_program_referral_claims";
export const RELEASE_APPROVAL_MIGRATION = "20260717120000_add_settlement_release_approval";
export const APPROVED_PRODUCTION_MIGRATION_BATCH = Object.freeze([
  "20260718100000_add_settlement_transfer_reversals",
  "20260718110000_harden_settlement_reversal_states",
  "20260718120000_add_seller_stripe_merchant_accounts",
]);
export const FIRST_APPROVED_MIGRATION = APPROVED_PRODUCTION_MIGRATION_BATCH[0];
export const TARGET_MIGRATION = APPROVED_PRODUCTION_MIGRATION_BATCH[1];
export const MERCHANT_MIGRATION = APPROVED_PRODUCTION_MIGRATION_BATCH[2];
export const OPERATIONS_MIGRATION = "20260719100000_add_settlement_operations_control_plane";
export const ANALYTICS_MIGRATION = "20260721100000_add_partner_referral_analytics";
export const ALLOWLISTED_PRODUCTION_MIGRATIONS = Object.freeze([
  ...APPROVED_PRODUCTION_MIGRATION_BATCH,
  OPERATIONS_MIGRATION,
  ANALYTICS_MIGRATION,
]);
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

const ALLOWLISTED_PENDING_MIGRATION_STATES = Object.freeze([
  Object.freeze([OPERATIONS_MIGRATION]),
  Object.freeze([ANALYTICS_MIGRATION]),
  Object.freeze([OPERATIONS_MIGRATION, ANALYTICS_MIGRATION]),
]);

function hasExactMigrationList(actual, expected) {
  return actual.length === expected.length
    && actual.every((migrationName, index) => migrationName === expected[index]);
}

function pendingSetError(message) {
  const error = new Error(message);
  error.code = "pending_set_mismatch";
  return error;
}

function assertApprovedMigrationRecordOrder(databaseRecords) {
  const approvedRecords = databaseRecords
    .filter((record) => ALLOWLISTED_PRODUCTION_MIGRATIONS.includes(record.migration_name))
    .map((record) => record.migration_name);
  const expectedPrefix = ALLOWLISTED_PRODUCTION_MIGRATIONS.slice(0, approvedRecords.length);
  if (!hasExactMigrationList(approvedRecords, expectedPrefix)) {
    throw pendingSetError("Approved production migrations are out of order.");
  }
}

function migrationState(localMigrationNames, databaseRecords, schemaEvidence) {
  const localNames = new Set(localMigrationNames);
  const databaseNames = new Set();

  if (localNames.size !== localMigrationNames.length) {
    throw pendingSetError("Local migration history contains duplicate names.");
  }

  if (!hasExactMigrationList(localMigrationNames, [...localMigrationNames].sort())) {
    throw pendingSetError("Local migration history is not in canonical order.");
  }

  const firstApprovedIndex = localMigrationNames.indexOf(FIRST_APPROVED_MIGRATION);
  const targetIndex = localMigrationNames.indexOf(TARGET_MIGRATION);
  const merchantIndex = localMigrationNames.indexOf(MERCHANT_MIGRATION);
  const operationsIndex = localMigrationNames.indexOf(OPERATIONS_MIGRATION);
  const analyticsIndex = localMigrationNames.indexOf(ANALYTICS_MIGRATION);
  if (firstApprovedIndex === -1
    || targetIndex !== firstApprovedIndex + 1
    || merchantIndex !== targetIndex + 1
    || operationsIndex !== merchantIndex + 1
    || analyticsIndex !== operationsIndex + 1
    || analyticsIndex !== localMigrationNames.length - 1) {
    throw pendingSetError("The approved migration batch is not the final local migration suffix.");
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

  assertApprovedMigrationRecordOrder(databaseRecords);

  const pendingMigrations = localMigrationNames.filter((name) => !databaseNames.has(name));

  if (pendingMigrations.length === 0) {
    if (!databaseNames.has(PREREQUISITE_MIGRATION)
      || !databaseNames.has(FIRST_APPROVED_MIGRATION)
      || !databaseNames.has(TARGET_MIGRATION)
      || !databaseNames.has(MERCHANT_MIGRATION)
      || !databaseNames.has(OPERATIONS_MIGRATION)
      || !databaseNames.has(ANALYTICS_MIGRATION)) {
      throw pendingSetError("The allowlisted production migration is not recorded.");
    }
    return { action: "skip", pendingMigrations };
  }

  const isAllowedPendingState = ALLOWLISTED_PENDING_MIGRATION_STATES.some(
    (allowed) => hasExactMigrationList(pendingMigrations, allowed),
  );
  if (!isAllowedPendingState
    || !databaseNames.has(FIRST_APPROVED_MIGRATION)
    || !databaseNames.has(TARGET_MIGRATION)
    || !databaseNames.has(MERCHANT_MIGRATION)
    || (pendingMigrations.includes(ANALYTICS_MIGRATION)
      && !databaseNames.has(OPERATIONS_MIGRATION)
      && !hasExactMigrationList(
        pendingMigrations,
        [OPERATIONS_MIGRATION, ANALYTICS_MIGRATION],
      ))) {
    throw pendingSetError("Production has an unexpected pending migration.");
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

export async function queryPrerequisitePreflight(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'PartnerProfile'
          AND table_type = 'BASE TABLE'
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
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND table_type = 'BASE TABLE'
      ) AS user_profile_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND column_name = 'id'
          AND data_type = 'text'
      ) AS user_profile_id_text,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'PartnerProfile'
          AND pg_constraint.contype IN ('p', 'u')
          AND array_length(pg_constraint.conkey, 1) = 1
          AND pg_constraint.conkey[1] = (
            SELECT pg_attribute.attnum
            FROM pg_attribute
            WHERE pg_attribute.attrelid = pg_class.oid
              AND pg_attribute.attname = 'id'
              AND NOT pg_attribute.attisdropped
          )
      ) AS partner_profile_id_key,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'UserProfile'
          AND pg_constraint.contype IN ('p', 'u')
          AND array_length(pg_constraint.conkey, 1) = 1
          AND pg_constraint.conkey[1] = (
            SELECT pg_attribute.attnum
            FROM pg_attribute
            WHERE pg_attribute.attrelid = pg_class.oid
              AND pg_attribute.attname = 'id'
              AND NOT pg_attribute.attisdropped
          )
      ) AS user_profile_id_key,
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

export async function queryTargetSchema(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 3
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'SettlementEventType'
          AND pg_type.typtype = 'e'
          AND pg_enum.enumlabel IN ('ADMIN_APPROVED', 'ADMIN_HELD', 'ADMIN_REEVALUATED')
      ) AS target_enum_values,
      EXISTS (
        SELECT 1
        FROM pg_type
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'SettlementEventType'
          AND pg_type.typtype = 'e'
      ) AS target_event_type_enum,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND table_type = 'BASE TABLE'
      ) AS target_user_profile_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserProfile'
          AND column_name = 'id'
          AND data_type = 'text'
      ) AS target_user_profile_id_text,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'UserProfile'
          AND constraint_row.contype IN ('p', 'u')
          AND array_length(constraint_row.conkey, 1) = 1
          AND constraint_row.conkey[1] = (
            SELECT attribute.attnum
            FROM pg_attribute attribute
            WHERE attribute.attrelid = table_row.oid
              AND attribute.attname = 'id'
              AND NOT attribute.attisdropped
          )
      ) AS target_user_profile_id_key,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND column_name = 'status'
      ) AS target_settlement_leg_status,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND column_name = 'holdUntil'
      ) AS target_settlement_leg_hold_until,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'status'
      ) AS target_settlement_reversal_status,
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

async function queryFirstMigrationPreflight(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND table_type = 'BASE TABLE'
      ) AS first_settlement_reversal_table,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND table_type = 'BASE TABLE'
      ) AS first_settlement_leg_table,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
        JOIN pg_class parent_table ON parent_table.oid = constraint_row.confrelid
        JOIN pg_namespace child_schema ON child_schema.oid = child_table.relnamespace
        JOIN pg_namespace parent_schema ON parent_schema.oid = parent_table.relnamespace
        WHERE child_schema.nspname = 'public'
          AND parent_schema.nspname = 'public'
          AND child_table.relname = 'SettlementReversal'
          AND parent_table.relname = 'Settlement'
          AND constraint_row.contype = 'f'
          AND ARRAY(
            SELECT attribute.attname::text
            FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_columns(attnum, ordinal)
            JOIN pg_attribute attribute
              ON attribute.attrelid = child_table.oid
             AND attribute.attnum = key_columns.attnum
            ORDER BY key_columns.ordinal
          ) = ARRAY['settlementId']::text[]
          AND ARRAY(
            SELECT attribute.attname::text
            FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_columns(attnum, ordinal)
            JOIN pg_attribute attribute
              ON attribute.attrelid = parent_table.oid
             AND attribute.attnum = key_columns.attnum
            ORDER BY key_columns.ordinal
          ) = ARRAY['id']::text[]
      ) AS first_settlement_reversal_settlement_fk,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
        JOIN pg_class parent_table ON parent_table.oid = constraint_row.confrelid
        JOIN pg_namespace child_schema ON child_schema.oid = child_table.relnamespace
        JOIN pg_namespace parent_schema ON parent_schema.oid = parent_table.relnamespace
        WHERE child_schema.nspname = 'public'
          AND parent_schema.nspname = 'public'
          AND child_table.relname = 'SettlementReversal'
          AND parent_table.relname = 'SettlementLeg'
          AND constraint_row.contype = 'f'
          AND ARRAY(
            SELECT attribute.attname::text
            FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_columns(attnum, ordinal)
            JOIN pg_attribute attribute
              ON attribute.attrelid = child_table.oid
             AND attribute.attnum = key_columns.attnum
            ORDER BY key_columns.ordinal
          ) = ARRAY['settlementId', 'settlementLegId']::text[]
          AND ARRAY(
            SELECT attribute.attname::text
            FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_columns(attnum, ordinal)
            JOIN pg_attribute attribute
              ON attribute.attrelid = parent_table.oid
             AND attribute.attnum = key_columns.attnum
            ORDER BY key_columns.ordinal
          ) = ARRAY['settlementId', 'id']::text[]
      ) AS first_settlement_reversal_leg_fk,
      (
        SELECT count(*) = 8
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name IN (
            'amount', 'status', 'reason', 'stripeRefundId', 'stripeDisputeId',
            'stripeTransferReversalId', 'reversalAttemptCount', 'reversalLockedAt'
          )
      ) AS first_settlement_reversal_columns,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND column_name = 'stripeTransferId'
      ) AS first_settlement_leg_transfer_id,
      NOT EXISTS (
        SELECT 1
        FROM pg_type
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'SettlementReversalSourceType'
      ) AS first_source_type_absent,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name IN (
            'requestedAmount', 'successfullyReversedAmount', 'sourceType',
            'stripeSourceObjectId', 'originalStripeTransferId'
          )
      ) AS first_new_columns_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal_sourceType_stripeSourceObjectId_settlementLegId_idx'
          AND pg_class.relkind = 'i'
      ) AS first_source_index_absent,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS first_anon_role,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS first_authenticated_role
  `);
  return result.rows[0] ?? null;
}

async function queryFirstMigrationSchema(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 3
          AND bool_and(pg_enum.enumlabel IN ('REFUND', 'DISPUTE_LOST', 'PAYMENT_FAILURE'))
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'SettlementReversalSourceType'
          AND pg_type.typtype = 'e'
      ) AS first_source_type_enum,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'requestedAmount'
      ) AS first_requested_amount,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'successfullyReversedAmount'
          AND data_type = 'integer'
          AND is_nullable = 'NO'
          AND column_default = '0'
      ) AS first_successfully_reversed_amount,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'sourceType'
          AND udt_name = 'SettlementReversalSourceType'
      ) AS first_source_type_column,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'stripeSourceObjectId'
      ) AS first_stripe_source_object_id,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'originalStripeTransferId'
      ) AS first_original_transfer_id,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal'
          AND pg_constraint.conname = 'SettlementReversal_requested_amount_check'
          AND pg_constraint.contype = 'c'
      ) AS first_requested_amount_check,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal'
          AND pg_constraint.conname = 'SettlementReversal_successfully_reversed_amount_check'
          AND pg_constraint.contype = 'c'
      ) AS first_successfully_reversed_amount_check,
      EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal_sourceType_stripeSourceObjectId_settlementLegId_idx'
          AND pg_class.relkind = 'i'
      ) AS first_source_index
  `);
  return result.rows[0] ?? null;
}

async function querySecondMigrationSchema(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 2
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'SettlementReversalStatus'
          AND pg_type.typtype = 'e'
          AND pg_enum.enumlabel IN ('FAILED', 'NEEDS_MANUAL_REVIEW')
      ) AS second_status_values,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementReversal'
          AND column_name = 'manualRequeueCount'
          AND data_type = 'integer'
          AND is_nullable = 'NO'
          AND column_default = '0'
      ) AS second_manual_requeue_count,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal'
          AND pg_constraint.conname = 'SettlementReversal_manual_requeue_count_check'
          AND pg_constraint.contype = 'c'
      ) AS second_manual_requeue_check,
      EXISTS (
        SELECT 1
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal_status_reversalLockedAt_idx'
          AND pg_class.relkind = 'i'
      ) AS second_status_index,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal'
          AND pg_constraint.conname = 'SettlementReversal_stripeTransferReversalId_status_check'
          AND pg_constraint.contype = 'c'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%completed%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%accounting_applied%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%pending%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%failed%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%needs_manual_review%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%stripetransferreversalid%is not null%'
          AND lower(pg_get_constraintdef(pg_constraint.oid)) LIKE '%stripetransferreversalid%is null%'
      ) AS second_status_constraint,
      (
        SELECT relrowsecurity
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'SettlementReversal'
          AND pg_class.relkind IN ('r', 'p')
      ) IS TRUE AS second_rls,
      NOT has_table_privilege('anon', 'public."SettlementReversal"', 'SELECT')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'INSERT')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'UPDATE')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'DELETE')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'TRUNCATE')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'REFERENCES')
        AND NOT has_table_privilege('anon', 'public."SettlementReversal"', 'TRIGGER')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'DELETE')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'TRUNCATE')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'REFERENCES')
        AND NOT has_table_privilege('authenticated', 'public."SettlementReversal"', 'TRIGGER')
        AS second_public_access_revoked
  `);
  return result.rows[0] ?? null;
}

export async function queryMerchantMigrationPreflight(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'Company'
          AND table_type = 'BASE TABLE'
      ) AS merchant_company_table,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Company'
          AND column_name = 'id'
          AND data_type = 'text'
      ) AS merchant_company_id_text,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'Company'
          AND constraint_row.contype IN ('p', 'u')
          AND array_length(constraint_row.conkey, 1) = 1
          AND constraint_row.conkey[1] = (
            SELECT attribute.attnum
            FROM pg_attribute attribute
            WHERE attribute.attrelid = table_row.oid
              AND attribute.attname = 'id'
              AND NOT attribute.attisdropped
          )
      ) AS merchant_company_id_key,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
      ) AS merchant_table_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_type type_row
        JOIN pg_namespace schema_row ON schema_row.oid = type_row.typnamespace
        WHERE schema_row.nspname = 'public'
          AND type_row.typname = 'SellerStripeMerchantAccountStatus'
      ) AS merchant_status_enum_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND index_row.relkind = 'i'
          AND index_row.relname = 'SellerStripeMerchantAccount_companyId_key'
      ) AS merchant_company_index_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND index_row.relkind = 'i'
          AND index_row.relname = 'SellerStripeMerchantAccount_stripeAccountId_key'
      ) AS merchant_stripe_index_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND index_row.relkind = 'i'
          AND index_row.relname = 'SellerStripeMerchantAccount_status_updatedAt_idx'
      ) AS merchant_status_index_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND constraint_row.conname = 'SellerStripeMerchantAccount_companyId_fkey'
      ) AS merchant_company_fk_absent,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS merchant_anon_role,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS merchant_authenticated_role
  `);
  return result.rows[0] ?? null;
}

export async function queryMerchantMigrationSchema(client) {
  const result = await client.query(`
    SELECT
      (
        SELECT count(*) = 5
          AND count(*) FILTER (WHERE enum_row.enumlabel IN (
            'ONBOARDING_INCOMPLETE', 'UNDER_REVIEW', 'ENABLED', 'RESTRICTED', 'DISABLED'
          )) = 5
        FROM pg_enum enum_row
        JOIN pg_type type_row ON type_row.oid = enum_row.enumtypid
        JOIN pg_namespace schema_row ON schema_row.oid = type_row.typnamespace
        WHERE schema_row.nspname = 'public'
          AND type_row.typname = 'SellerStripeMerchantAccountStatus'
          AND type_row.typtype = 'e'
      ) AS merchant_status_enum,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
          AND table_type = 'BASE TABLE'
      ) AS merchant_table,
      (
        SELECT count(*) = 17
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
      ) AS merchant_columns_total,
      (
        SELECT count(*) = 17
          AND count(*) FILTER (WHERE column_name IN (
            'id', 'companyId', 'stripeAccountId', 'country', 'status',
            'chargesEnabled', 'payoutsEnabled', 'cardPaymentsEnabled', 'transfersEnabled',
            'detailsSubmitted', 'onboardingComplete', 'requirementsOutstanding',
            'controllerFeesPayer', 'controllerLossesPayments', 'dashboardType',
            'createdAt', 'updatedAt'
          )) = 17
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
      ) AS merchant_columns_names,
      (
        SELECT count(*) = 17
          AND count(*) FILTER (WHERE (
            (column_name IN ('id', 'companyId', 'stripeAccountId', 'country', 'controllerFeesPayer',
              'controllerLossesPayments', 'dashboardType')
              AND data_type = 'text')
            OR (column_name = 'status' AND data_type = 'USER-DEFINED'
              AND udt_schema = 'public' AND udt_name = 'SellerStripeMerchantAccountStatus')
            OR (column_name IN ('chargesEnabled', 'payoutsEnabled', 'cardPaymentsEnabled',
              'transfersEnabled', 'detailsSubmitted', 'onboardingComplete', 'requirementsOutstanding')
              AND data_type = 'boolean')
            OR (column_name IN ('createdAt', 'updatedAt') AND data_type = 'timestamp without time zone')
          )) = 17
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
      ) AS merchant_column_types,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND constraint_row.conname = 'SellerStripeMerchantAccount_pkey'
          AND constraint_row.contype = 'p'
          AND array_length(constraint_row.conkey, 1) = 1
          AND constraint_row.conkey[1] = (
            SELECT attribute.attnum
            FROM pg_attribute attribute
            WHERE attribute.attrelid = table_row.oid
              AND attribute.attname = 'id'
              AND NOT attribute.attisdropped
          )
      ) AS merchant_primary_key,
      EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid
        JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
        JOIN pg_am access_method ON access_method.oid = index_row.relam
        JOIN pg_attribute attribute ON attribute.attrelid = table_row.oid
          AND attribute.attnum = index_meta.indkey[0]
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND index_row.relname = 'SellerStripeMerchantAccount_companyId_key'
          AND index_row.relkind = 'i'
          AND access_method.amname = 'btree'
          AND index_meta.indisvalid
          AND index_meta.indisready
          AND index_meta.indpred IS NULL
          AND index_meta.indexprs IS NULL
          AND index_meta.indisunique
          AND index_meta.indnatts = 1
          AND index_meta.indnkeyatts = 1
          AND index_meta.indnatts = index_meta.indnkeyatts
          AND NOT attribute.attisdropped
          AND attribute.attname = 'companyId'
      ) AS merchant_company_unique,
      EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid
        JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
        JOIN pg_am access_method ON access_method.oid = index_row.relam
        JOIN pg_attribute attribute ON attribute.attrelid = table_row.oid
          AND attribute.attnum = index_meta.indkey[0]
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND index_row.relname = 'SellerStripeMerchantAccount_stripeAccountId_key'
          AND index_row.relkind = 'i'
          AND access_method.amname = 'btree'
          AND index_meta.indisvalid
          AND index_meta.indisready
          AND index_meta.indpred IS NULL
          AND index_meta.indexprs IS NULL
          AND index_meta.indisunique
          AND index_meta.indnatts = 1
          AND index_meta.indnkeyatts = 1
          AND index_meta.indnatts = index_meta.indnkeyatts
          AND NOT attribute.attisdropped
          AND attribute.attname = 'stripeAccountId'
      ) AS merchant_stripe_unique,
      EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid
        JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
        JOIN pg_am access_method ON access_method.oid = index_row.relam
        JOIN pg_attribute status_attribute ON status_attribute.attrelid = table_row.oid
          AND status_attribute.attname = 'status'
          AND NOT status_attribute.attisdropped
        JOIN pg_attribute updated_attribute ON updated_attribute.attrelid = table_row.oid
          AND updated_attribute.attname = 'updatedAt'
          AND NOT updated_attribute.attisdropped
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND index_row.relname = 'SellerStripeMerchantAccount_status_updatedAt_idx'
          AND index_row.relkind = 'i'
          AND access_method.amname = 'btree'
          AND index_meta.indisvalid
          AND index_meta.indisready
          AND index_meta.indpred IS NULL
          AND index_meta.indexprs IS NULL
          AND NOT index_meta.indisunique
          AND index_meta.indnatts = 2
          AND index_meta.indnkeyatts = 2
          AND index_meta.indnatts = index_meta.indnkeyatts
          AND index_meta.indkey[0] = status_attribute.attnum
          AND index_meta.indkey[1] = updated_attribute.attnum
      ) AS merchant_status_index,
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class child_row ON child_row.oid = constraint_row.conrelid
        JOIN pg_class parent_row ON parent_row.oid = constraint_row.confrelid
        JOIN pg_namespace child_schema ON child_schema.oid = child_row.relnamespace
        JOIN pg_namespace parent_schema ON parent_schema.oid = parent_row.relnamespace
        WHERE child_schema.nspname = 'public'
          AND parent_schema.nspname = 'public'
          AND child_row.relname = 'SellerStripeMerchantAccount'
          AND parent_row.relname = 'Company'
          AND constraint_row.conname = 'SellerStripeMerchantAccount_companyId_fkey'
          AND constraint_row.contype = 'f'
          AND array_length(constraint_row.conkey, 1) = 1
          AND array_length(constraint_row.confkey, 1) = 1
          AND constraint_row.conkey[1] = (
            SELECT attribute.attnum
            FROM pg_attribute attribute
            WHERE attribute.attrelid = child_row.oid
              AND attribute.attname = 'companyId'
              AND NOT attribute.attisdropped
          )
          AND constraint_row.confkey[1] = (
            SELECT attribute.attnum
            FROM pg_attribute attribute
            WHERE attribute.attrelid = parent_row.oid
              AND attribute.attname = 'id'
              AND NOT attribute.attisdropped
          )
          AND constraint_row.confdeltype = 'r'
          AND constraint_row.confupdtype = 'c'
      ) AS merchant_company_fk_restrict,
      (
        SELECT count(*) = 17
          AND count(*) FILTER (WHERE column_name IN (
            'status', 'chargesEnabled', 'payoutsEnabled', 'cardPaymentsEnabled',
            'transfersEnabled', 'detailsSubmitted', 'onboardingComplete',
            'requirementsOutstanding', 'controllerFeesPayer',
            'controllerLossesPayments', 'dashboardType', 'createdAt'
          ) AND default_expression IS NOT NULL) = 12
          AND count(*) FILTER (WHERE column_name IN (
            'id', 'companyId', 'stripeAccountId', 'country', 'updatedAt'
          ) AND default_expression IS NULL) = 5
          AND count(*) FILTER (WHERE (
            (column_name = 'status'
              AND default_expression = '''ONBOARDING_INCOMPLETE''::"SellerStripeMerchantAccountStatus"')
            OR (column_name IN (
              'chargesEnabled', 'payoutsEnabled', 'cardPaymentsEnabled', 'transfersEnabled',
              'detailsSubmitted', 'onboardingComplete', 'requirementsOutstanding'
            ) AND default_expression = 'false')
            OR (column_name = 'controllerFeesPayer' AND default_expression = '''account''::text')
            OR (column_name = 'controllerLossesPayments' AND default_expression = '''stripe''::text')
            OR (column_name = 'dashboardType' AND default_expression = '''full''::text')
            OR (column_name = 'createdAt' AND default_expression = 'CURRENT_TIMESTAMP')
          )) = 12
        FROM (
          SELECT column_row.column_name,
            regexp_replace(
              pg_get_expr(default_row.adbin, default_row.adrelid),
              '\\s+', '', 'g'
            ) AS default_expression
          FROM information_schema.columns column_row
          JOIN pg_class table_row ON table_row.relname = column_row.table_name
          JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
            AND schema_row.nspname = column_row.table_schema
          JOIN pg_attribute attribute_row ON attribute_row.attrelid = table_row.oid
            AND attribute_row.attname = column_row.column_name
            AND NOT attribute_row.attisdropped
          LEFT JOIN pg_attrdef default_row ON default_row.adrelid = attribute_row.attrelid
            AND default_row.adnum = attribute_row.attnum
          WHERE column_row.table_schema = 'public'
            AND column_row.table_name = 'SellerStripeMerchantAccount'
        ) defaults
      ) AS merchant_defaults,
      (
        SELECT count(*) = 17
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SellerStripeMerchantAccount'
          AND is_nullable = 'NO'
      ) AS merchant_nullability,
      (
        SELECT relrowsecurity
        FROM pg_class table_row
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname = 'SellerStripeMerchantAccount'
          AND table_row.relkind IN ('r', 'p')
      ) IS TRUE AS merchant_rls,
      NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'SELECT')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'INSERT')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'UPDATE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'DELETE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'TRUNCATE')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'REFERENCES')
        AND NOT has_table_privilege('anon', 'public."SellerStripeMerchantAccount"', 'TRIGGER')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'SELECT')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'INSERT')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'UPDATE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'DELETE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'TRUNCATE')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'REFERENCES')
        AND NOT has_table_privilege('authenticated', 'public."SellerStripeMerchantAccount"', 'TRIGGER')
        AS merchant_public_access_revoked
  `);
  return result.rows[0] ?? null;
}

export async function queryMerchantMigrationInitialState(client) {
  const result = await client.query(`
    SELECT (
      SELECT count(*) = 0
      FROM public."SellerStripeMerchantAccount"
    ) AS merchant_zero_rows
  `);
  return result.rows[0] ?? null;
}

export async function queryOperationsMigrationPreflight(client) {
  const result = await client.query(`
    SELECT
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Settlement'
          AND column_name = 'paymentFlow'
      ) AS operations_payment_flow_absent,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND column_name = 'manualReviewRequired'
      ) AS operations_leg_manual_review_absent,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
      ) AS operations_tables_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_type
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname IN (
            'SettlementPaymentFlow',
            'SettlementWorkerType',
            'SettlementWorkerRunStatus',
            'SettlementOperationalAlertType',
            'SettlementOperationalAlertSeverity',
            'SettlementOperationalAlertStatus'
          )
      ) AS operations_enum_types_absent
  `);
  return result.rows[0] ?? null;
}

export async function queryOperationsMigrationSchema(client) {
  const result = await client.query(`
    WITH expected_enums(type_name, labels) AS (
      VALUES
        ('SettlementPaymentFlow', ARRAY['SCT', 'DIRECT_CHARGE']::text[]),
        ('SettlementWorkerType', ARRAY['TRANSFER', 'REVERSAL', 'STALE_RECOVERY', 'METRIC_SNAPSHOT']::text[]),
        ('SettlementWorkerRunStatus', ARRAY['RUNNING', 'SUCCEEDED', 'PARTIALLY_FAILED', 'FAILED', 'SKIPPED']::text[]),
        ('SettlementOperationalAlertType', ARRAY[
          'TRANSFER_RETRY_EXHAUSTED', 'REVERSAL_RETRY_EXHAUSTED',
          'TRANSFER_NEEDS_MANUAL_REVIEW', 'REVERSAL_NEEDS_MANUAL_REVIEW',
          'STALE_TRANSFER_CLAIM', 'STALE_REVERSAL_CLAIM', 'WORKER_FAILED',
          'WORKER_PARTIALLY_FAILED', 'LONG_PENDING_TRANSFER', 'LONG_PENDING_REVERSAL',
          'DISPUTE_OPEN_WITH_READY_TRANSFER', 'REFUND_WITH_UNREVERSED_TRANSFER'
        ]::text[]),
        ('SettlementOperationalAlertSeverity', ARRAY['INFO', 'WARNING', 'CRITICAL']::text[]),
        ('SettlementOperationalAlertStatus', ARRAY['OPEN', 'ACKNOWLEDGED', 'RESOLVED']::text[])
    ),
    expected_columns(table_name, column_name, data_type, udt_name, nullable, default_expression) AS (
      VALUES
        ('SettlementWorkerRun', 'id', 'text', 'text', 'NO', NULL::text),
        ('SettlementWorkerRun', 'workerType', 'USER-DEFINED', 'SettlementWorkerType', 'NO', NULL::text),
        ('SettlementWorkerRun', 'executionMode', 'text', 'text', 'NO', NULL::text),
        ('SettlementWorkerRun', 'status', 'USER-DEFINED', 'SettlementWorkerRunStatus', 'NO', '''RUNNING''::"SettlementWorkerRunStatus"'),
        ('SettlementWorkerRun', 'startedAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('SettlementWorkerRun', 'completedAt', 'timestamp without time zone', 'timestamp', 'YES', NULL::text),
        ('SettlementWorkerRun', 'scannedCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'claimedCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'succeededCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'failedCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'skippedCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'manualReviewCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'staleRecoveredCount', 'integer', 'int4', 'NO', '0'),
        ('SettlementWorkerRun', 'durationMs', 'integer', 'int4', 'YES', NULL::text),
        ('SettlementWorkerRun', 'sanitizedErrorCode', 'character varying', 'varchar', 'YES', NULL::text),
        ('SettlementWorkerRun', 'createdAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('SettlementWorkerRun', 'updatedAt', 'timestamp without time zone', 'timestamp', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'id', 'text', 'text', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'alertType', 'USER-DEFINED', 'SettlementOperationalAlertType', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'severity', 'USER-DEFINED', 'SettlementOperationalAlertSeverity', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'status', 'USER-DEFINED', 'SettlementOperationalAlertStatus', 'NO', '''OPEN''::"SettlementOperationalAlertStatus"'),
        ('SettlementOperationalAlert', 'settlementId', 'text', 'text', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'settlementLegId', 'text', 'text', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'settlementReversalId', 'text', 'text', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'workerRunId', 'text', 'text', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'title', 'text', 'text', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'sanitizedMessage', 'character varying', 'varchar', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'occurrenceCount', 'integer', 'int4', 'NO', '1'),
        ('SettlementOperationalAlert', 'firstOccurredAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('SettlementOperationalAlert', 'lastOccurredAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('SettlementOperationalAlert', 'acknowledgedAt', 'timestamp without time zone', 'timestamp', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'acknowledgedByUserId', 'text', 'text', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'resolvedAt', 'timestamp without time zone', 'timestamp', 'YES', NULL::text),
        ('SettlementOperationalAlert', 'deduplicationKey', 'text', 'text', 'NO', NULL::text),
        ('SettlementOperationalAlert', 'createdAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('SettlementOperationalAlert', 'updatedAt', 'timestamp without time zone', 'timestamp', 'NO', NULL::text)
    ),
    expected_typmods(table_name, column_name, character_maximum_length) AS (
      VALUES
        ('SettlementWorkerRun', 'sanitizedErrorCode', 64),
        ('SettlementOperationalAlert', 'sanitizedMessage', 1000)
    ),
    actual_columns AS (
      SELECT column_row.table_name, column_row.column_name, column_row.data_type,
        column_row.udt_name, column_row.is_nullable, column_row.character_maximum_length,
        regexp_replace(COALESCE(pg_get_expr(default_row.adbin, default_row.adrelid), ''), '\\s+', '', 'g') AS default_expression
      FROM information_schema.columns column_row
      JOIN pg_class table_row ON table_row.relname = column_row.table_name
      JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        AND schema_row.nspname = column_row.table_schema
      JOIN pg_attribute attribute_row ON attribute_row.attrelid = table_row.oid
        AND attribute_row.attname = column_row.column_name
        AND NOT attribute_row.attisdropped
      LEFT JOIN pg_attrdef default_row ON default_row.adrelid = attribute_row.attrelid
        AND default_row.adnum = attribute_row.attnum
      WHERE column_row.table_schema = 'public'
        AND table_row.relkind IN ('r', 'p')
        AND column_row.table_name IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
    ),
    expected_indexes(index_name, table_name, key_columns, is_unique) AS (
      VALUES
        ('SettlementWorkerRun_workerType_status_startedAt_idx', 'SettlementWorkerRun', ARRAY['workerType', 'status', 'startedAt']::text[], false),
        ('SettlementWorkerRun_status_startedAt_idx', 'SettlementWorkerRun', ARRAY['status', 'startedAt']::text[], false),
        ('SettlementOperationalAlert_status_severity_lastOccurredAt_idx', 'SettlementOperationalAlert', ARRAY['status', 'severity', 'lastOccurredAt']::text[], false),
        ('SettlementOperationalAlert_settlementId_status_idx', 'SettlementOperationalAlert', ARRAY['settlementId', 'status']::text[], false),
        ('SettlementOperationalAlert_settlementLegId_status_idx', 'SettlementOperationalAlert', ARRAY['settlementLegId', 'status']::text[], false),
        ('SettlementOperationalAlert_settlementReversalId_status_idx', 'SettlementOperationalAlert', ARRAY['settlementReversalId', 'status']::text[], false),
        ('SettlementOperationalAlert_workerRunId_idx', 'SettlementOperationalAlert', ARRAY['workerRunId']::text[], false),
        ('SettlementLeg_status_nextTransferAttemptAt_transferLockedAt_idx', 'SettlementLeg', ARRAY['status', 'nextTransferAttemptAt', 'transferLockedAt']::text[], false),
        ('SettlementLeg_manualReviewRequired_status_idx', 'SettlementLeg', ARRAY['manualReviewRequired', 'status']::text[], false),
        ('SettlementReversal_status_nextReversalAttemptAt_reversalLockedAt_idx', 'SettlementReversal', ARRAY['status', 'nextReversalAttemptAt', 'reversalLockedAt']::text[], false)
    ),
    actual_indexes AS (
      SELECT expected.index_name, expected.table_name, expected.key_columns, expected.is_unique,
        index_meta.indisvalid, index_meta.indisready, index_meta.indpred, index_meta.indexprs,
        index_meta.indisunique, index_meta.indnatts, index_meta.indnkeyatts,
        access_method.amname,
        ARRAY(
          SELECT attribute_row.attname::text
          FROM unnest(index_meta.indkey) WITH ORDINALITY AS key_row(attnum, ord)
          JOIN pg_attribute attribute_row ON attribute_row.attrelid = table_row.oid
            AND attribute_row.attnum = key_row.attnum
          WHERE key_row.ord <= index_meta.indnkeyatts
          ORDER BY key_row.ord
        ) AS actual_key_columns
      FROM expected_indexes expected
      LEFT JOIN pg_class index_row ON index_row.relname = left(expected.index_name, 63)
      LEFT JOIN pg_namespace index_schema ON index_schema.oid = index_row.relnamespace
        AND index_schema.nspname = 'public'
      LEFT JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid
      LEFT JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
      LEFT JOIN pg_am access_method ON access_method.oid = index_row.relam
      WHERE index_row.relkind = 'i' AND index_schema.oid IS NOT NULL
    ),
    constraint_meta AS (
      SELECT constraint_row.oid, constraint_row.conname, constraint_row.contype,
        constraint_row.conkey,
        lower(regexp_replace(pg_get_constraintdef(constraint_row.oid), '[^a-zA-Z0-9<>=]+', '', 'g')) AS normalized_definition
      FROM pg_constraint constraint_row
      JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
      WHERE schema_row.nspname = 'public'
        AND ((table_row.relname = 'SettlementWorkerRun' AND constraint_row.conname IN ('SettlementWorkerRun_pkey', 'SettlementWorkerRun_counts_check'))
          OR (table_row.relname = 'SettlementOperationalAlert' AND constraint_row.conname IN (
            'SettlementOperationalAlert_pkey', 'SettlementOperationalAlert_deduplicationKey_key',
            'SettlementOperationalAlert_occurrenceCount_check', 'SettlementOperationalAlert_settlementId_fkey',
            'SettlementOperationalAlert_settlementLegId_fkey', 'SettlementOperationalAlert_settlementReversalId_fkey',
            'SettlementOperationalAlert_workerRunId_fkey', 'SettlementOperationalAlert_acknowledgedByUserId_fkey')))
    ),
    expected_fks(child_column, parent_table, delete_action) AS (
      VALUES
        ('settlementId', 'Settlement', 'r'),
        ('settlementLegId', 'SettlementLeg', 'r'),
        ('settlementReversalId', 'SettlementReversal', 'r'),
        ('workerRunId', 'SettlementWorkerRun', 'n'),
        ('acknowledgedByUserId', 'UserProfile', 'n')
    )
    SELECT
      (
        SELECT count(*) = 6
        FROM pg_type
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname IN (
            'SettlementPaymentFlow',
            'SettlementWorkerType',
            'SettlementWorkerRunStatus',
            'SettlementOperationalAlertType',
            'SettlementOperationalAlertSeverity',
            'SettlementOperationalAlertStatus'
          )
          AND pg_type.typtype = 'e'
      ) AS operations_enum_types,
      (
        SELECT count(*) = 6 AND bool_and(
          (SELECT array_agg(pg_enum.enumlabel::text ORDER BY pg_enum.enumsortorder)
           FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
           JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
           WHERE pg_namespace.nspname = 'public' AND pg_type.typname = expected.type_name AND pg_type.typtype = 'e') = expected.labels
        )
        FROM expected_enums expected
      ) AS operations_enum_values,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Settlement'
          AND column_name = 'paymentFlow'
          AND udt_name = 'SettlementPaymentFlow'
          AND is_nullable = 'NO'
          AND column_default = '''SCT''::"SettlementPaymentFlow"'
      ) AS operations_payment_flow_column,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SettlementLeg'
          AND column_name = 'manualReviewRequired'
          AND data_type = 'boolean'
          AND is_nullable = 'NO'
          AND column_default = 'false'
      ) AS operations_leg_manual_review,
      (
        SELECT count(*) = 2
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
          AND table_type = 'BASE TABLE'
      ) AS operations_tables,
      (
        SELECT count(*) = 17 AND NOT EXISTS (
          SELECT 1 FROM expected_columns expected
          LEFT JOIN actual_columns actual USING (table_name, column_name)
          WHERE expected.table_name = 'SettlementWorkerRun'
            AND (
              actual.column_name IS NULL
              OR actual.data_type <> expected.data_type
              OR actual.udt_name <> expected.udt_name
              OR actual.is_nullable <> expected.nullable
              OR COALESCE(actual.character_maximum_length, -1) <> COALESCE((SELECT expected_typmod.character_maximum_length FROM expected_typmods expected_typmod WHERE expected_typmod.table_name = expected.table_name AND expected_typmod.column_name = expected.column_name), -1)
              OR COALESCE(expected.default_expression, '') <> COALESCE(actual.default_expression, '')
            )
        )
        FROM actual_columns WHERE table_name = 'SettlementWorkerRun'
      ) AS operations_worker_columns,
      (
        SELECT count(*) = 19 AND NOT EXISTS (
          SELECT 1 FROM expected_columns expected
          LEFT JOIN actual_columns actual USING (table_name, column_name)
          WHERE expected.table_name = 'SettlementOperationalAlert'
            AND (
              actual.column_name IS NULL
              OR actual.data_type <> expected.data_type
              OR actual.is_nullable <> expected.nullable
              OR actual.udt_name <> expected.udt_name
              OR COALESCE(actual.character_maximum_length, -1) <> COALESCE((SELECT expected_typmod.character_maximum_length FROM expected_typmods expected_typmod WHERE expected_typmod.table_name = expected.table_name AND expected_typmod.column_name = expected.column_name), -1)
              OR COALESCE(expected.default_expression, '') <> COALESCE(actual.default_expression, '')
            )
        )
        FROM actual_columns WHERE table_name = 'SettlementOperationalAlert'
      ) AS operations_alert_columns,
      (
        SELECT count(*) = 10 AND bool_and(indisvalid AND indisready AND indpred IS NULL AND indexprs IS NULL
          AND amname = 'btree' AND indisunique = expected.is_unique
          AND indnatts = cardinality(key_columns) AND indnkeyatts = cardinality(key_columns)
          AND actual_key_columns = key_columns)
        FROM actual_indexes JOIN expected_indexes expected USING (index_name, table_name, key_columns, is_unique)
      ) AS operations_indexes,
      (
        SELECT count(*) = 10
          AND bool_and(
            (conname = 'SettlementWorkerRun_pkey' AND contype = 'p'
              AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public."SettlementWorkerRun"'::regclass AND attname = 'id' AND NOT attisdropped)]::smallint[])
            OR (conname = 'SettlementOperationalAlert_pkey' AND contype = 'p'
              AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public."SettlementOperationalAlert"'::regclass AND attname = 'id' AND NOT attisdropped)]::smallint[])
            OR (conname = 'SettlementOperationalAlert_deduplicationKey_key' AND contype = 'u'
              AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public."SettlementOperationalAlert"'::regclass AND attname = 'deduplicationKey' AND NOT attisdropped)]::smallint[])
            OR (conname = 'SettlementWorkerRun_counts_check' AND contype = 'c'
              AND normalized_definition = 'checkscannedcount>=0andclaimedcount>=0andsucceededcount>=0andfailedcount>=0andskippedcount>=0andmanualreviewcount>=0andstalerecoveredcount>=0anddurationmsisnullordurationms>=0')
            OR (conname = 'SettlementOperationalAlert_occurrenceCount_check' AND contype = 'c'
              AND normalized_definition = 'checkoccurrencecount>0')
            OR conname LIKE 'SettlementOperationalAlert_%_fkey'
          )
        FROM constraint_meta
      ) AS operations_constraints,
      (
        SELECT count(*) = 5 AND bool_and(
          constraint_row.contype = 'f'
          AND constraint_row.confdeltype = expected.delete_action
          AND constraint_row.confupdtype = 'c'
          AND constraint_row.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = constraint_row.conrelid AND attname = expected.child_column AND NOT attisdropped)]::smallint[]
          AND constraint_row.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = constraint_row.confrelid AND attname = 'id' AND NOT attisdropped)]::smallint[]
          AND constraint_row.confrelid = (SELECT parent_class.oid FROM pg_class parent_class WHERE parent_class.relname = expected.parent_table AND parent_class.relnamespace = 'public'::regnamespace)
        )
        FROM pg_constraint constraint_row
        JOIN expected_fks expected ON constraint_row.conname = 'SettlementOperationalAlert_' || expected.child_column || '_fkey'
        WHERE constraint_row.conrelid = 'public."SettlementOperationalAlert"'::regclass
      ) AS operations_restrictive_fks,
      (
        SELECT count(*) = 2
        FROM pg_class table_row
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname IN ('SettlementWorkerRun', 'SettlementOperationalAlert')
          AND table_row.relkind IN ('r', 'p')
          AND table_row.relrowsecurity IS TRUE
      ) AS operations_rls,
      NOT EXISTS (
        SELECT 1
        FROM (VALUES ('anon'::name), ('authenticated'::name)) roles(role_name)
        CROSS JOIN (VALUES ('SettlementWorkerRun'::text), ('SettlementOperationalAlert'::text)) tables(table_name)
        CROSS JOIN (VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text), ('TRUNCATE'::text), ('REFERENCES'::text), ('TRIGGER'::text)) privileges(privilege_name)
        WHERE has_table_privilege(roles.role_name, format('public.%I', tables.table_name), privileges.privilege_name)
      )
        AS operations_public_access_revoked
  `);
  return result.rows[0] ?? null;
}

export async function queryOperationsMigrationInitialState(client) {
  const result = await client.query(`
    SELECT
      (SELECT count(*) = 0 FROM public."SettlementWorkerRun") AS operations_worker_run_zero_rows,
      (SELECT count(*) = 0 FROM public."SettlementOperationalAlert") AS operations_alert_zero_rows
  `);
  return result.rows[0] ?? null;
}

export async function queryAnalyticsMigrationPreflight(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'PartnerProfile'
          AND table_type = 'BASE TABLE'
      ) AS analytics_partner_profile_table,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ReferralAttribution'
          AND table_type = 'BASE TABLE'
      ) AS analytics_referral_attribution_table,
      EXISTS (
        SELECT 1
        FROM pg_type
        JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'ReferralSubjectType'
          AND pg_type.typtype = 'e'
      ) AS analytics_subject_type_enum,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('ReferralClickDailyVisitor', 'ReferralConversion')
      ) AS analytics_tables_absent,
      NOT EXISTS (
        SELECT 1
        FROM pg_class index_row
        JOIN pg_namespace schema_row ON schema_row.oid = index_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND index_row.relname IN (
            'ReferralClickDailyVisitor_partnerProfileId_visitorHash_day_key',
            'ReferralClickDailyVisitor_partnerProfileId_day_idx',
            'ReferralConversion_referralAttributionId_subjectType_key',
            'ReferralConversion_partnerProfileId_convertedAt_idx'
          )
      ) AS analytics_indexes_absent
  `);
  return result.rows[0] ?? null;
}

export async function queryAnalyticsMigrationSchema(client) {
  const result = await client.query(`
    WITH expected_columns(table_name, column_name, data_type, udt_name, nullable, default_expression) AS (
      VALUES
        ('ReferralClickDailyVisitor', 'id', 'text', 'text', 'NO', NULL::text),
        ('ReferralClickDailyVisitor', 'partnerProfileId', 'text', 'text', 'NO', NULL::text),
        ('ReferralClickDailyVisitor', 'visitorHash', 'text', 'text', 'NO', NULL::text),
        ('ReferralClickDailyVisitor', 'day', 'date', 'date', 'NO', NULL::text),
        ('ReferralClickDailyVisitor', 'clickCount', 'integer', 'int4', 'NO', '1'),
        ('ReferralClickDailyVisitor', 'firstClickedAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('ReferralClickDailyVisitor', 'lastClickedAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('ReferralClickDailyVisitor', 'createdAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
        ('ReferralClickDailyVisitor', 'updatedAt', 'timestamp without time zone', 'timestamp', 'NO', NULL::text),
        ('ReferralConversion', 'id', 'text', 'text', 'NO', NULL::text),
        ('ReferralConversion', 'partnerProfileId', 'text', 'text', 'NO', NULL::text),
        ('ReferralConversion', 'referralAttributionId', 'text', 'text', 'NO', NULL::text),
        ('ReferralConversion', 'subjectType', 'USER-DEFINED', 'ReferralSubjectType', 'NO', NULL::text),
        ('ReferralConversion', 'convertedAt', 'timestamp without time zone', 'timestamp', 'NO', NULL::text),
        ('ReferralConversion', 'createdAt', 'timestamp without time zone', 'timestamp', 'NO', 'CURRENT_TIMESTAMP')
    ),
    actual_columns AS (
      SELECT column_row.table_name, column_row.column_name, column_row.data_type,
        column_row.udt_name, column_row.is_nullable,
        regexp_replace(COALESCE(pg_get_expr(default_row.adbin, default_row.adrelid), ''), '\\s+', '', 'g') AS default_expression
      FROM information_schema.columns column_row
      JOIN pg_class table_row ON table_row.relname = column_row.table_name
      JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        AND schema_row.nspname = column_row.table_schema
      JOIN pg_attribute attribute_row ON attribute_row.attrelid = table_row.oid
        AND attribute_row.attname = column_row.column_name
        AND NOT attribute_row.attisdropped
      LEFT JOIN pg_attrdef default_row ON default_row.adrelid = attribute_row.attrelid
        AND default_row.adnum = attribute_row.attnum
      WHERE column_row.table_schema = 'public'
        AND table_row.relkind IN ('r', 'p')
        AND column_row.table_name IN ('ReferralClickDailyVisitor', 'ReferralConversion')
    ),
    expected_indexes(index_name, table_name, key_columns, is_unique) AS (
      VALUES
        ('ReferralClickDailyVisitor_partnerProfileId_visitorHash_day_key', 'ReferralClickDailyVisitor', ARRAY['partnerProfileId', 'visitorHash', 'day']::text[], true),
        ('ReferralClickDailyVisitor_partnerProfileId_day_idx', 'ReferralClickDailyVisitor', ARRAY['partnerProfileId', 'day']::text[], false),
        ('ReferralConversion_referralAttributionId_subjectType_key', 'ReferralConversion', ARRAY['referralAttributionId', 'subjectType']::text[], true),
        ('ReferralConversion_partnerProfileId_convertedAt_idx', 'ReferralConversion', ARRAY['partnerProfileId', 'convertedAt']::text[], false)
    ),
    actual_indexes AS (
      SELECT expected.index_name, expected.key_columns, expected.is_unique,
        index_meta.indisvalid, index_meta.indisready, index_meta.indpred, index_meta.indexprs,
        index_meta.indisunique, index_meta.indnatts, index_meta.indnkeyatts, access_method.amname,
        ARRAY(
          SELECT attribute_row.attname::text
          FROM unnest(index_meta.indkey) WITH ORDINALITY AS key_row(attnum, ord)
          JOIN pg_attribute attribute_row ON attribute_row.attrelid = table_row.oid
            AND attribute_row.attnum = key_row.attnum
          WHERE key_row.ord <= index_meta.indnkeyatts
          ORDER BY key_row.ord
        ) AS actual_key_columns
      FROM expected_indexes expected
      LEFT JOIN pg_class index_row ON index_row.relname = left(expected.index_name, 63)
        AND index_row.relnamespace = 'public'::regnamespace
      LEFT JOIN pg_index index_meta ON index_meta.indexrelid = index_row.oid
      LEFT JOIN pg_class table_row ON table_row.oid = index_meta.indrelid
      LEFT JOIN pg_am access_method ON access_method.oid = index_row.relam
    ),
    expected_fks(table_name, constraint_name, child_column, parent_table) AS (
      VALUES
        ('ReferralClickDailyVisitor', 'ReferralClickDailyVisitor_partnerProfileId_fkey', 'partnerProfileId', 'PartnerProfile'),
        ('ReferralConversion', 'ReferralConversion_partnerProfileId_fkey', 'partnerProfileId', 'PartnerProfile'),
        ('ReferralConversion', 'ReferralConversion_referralAttributionId_fkey', 'referralAttributionId', 'ReferralAttribution')
    ),
    actual_fks AS (
      SELECT expected.*, constraint_row.conkey, constraint_row.confkey,
        constraint_row.conrelid, constraint_row.confrelid,
        constraint_row.confdeltype, constraint_row.confupdtype,
        constraint_row.contype, child_table.oid AS child_oid, parent_table.oid AS parent_oid
      FROM expected_fks expected
      LEFT JOIN pg_constraint constraint_row ON constraint_row.conname = expected.constraint_name
      LEFT JOIN pg_class child_table ON child_table.relname = expected.table_name
        AND child_table.relnamespace = 'public'::regnamespace
      LEFT JOIN pg_class parent_table ON parent_table.relname = expected.parent_table
        AND parent_table.relnamespace = 'public'::regnamespace
    )
    SELECT
      (
        SELECT count(*) = 2
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('ReferralClickDailyVisitor', 'ReferralConversion')
          AND table_type = 'BASE TABLE'
      ) AS analytics_tables,
      (
        SELECT count(*) = 15 AND NOT EXISTS (
          SELECT 1
          FROM expected_columns expected
          LEFT JOIN actual_columns actual USING (table_name, column_name)
          WHERE actual.column_name IS NULL
            OR actual.data_type <> expected.data_type
            OR actual.udt_name <> expected.udt_name
            OR actual.is_nullable <> expected.nullable
            OR COALESCE(actual.default_expression, '') <> COALESCE(expected.default_expression, '')
        )
        FROM actual_columns
      ) AS analytics_columns,
      (
        SELECT count(*) = 4 AND bool_and(
          COALESCE(indisvalid, false) AND COALESCE(indisready, false)
          AND indpred IS NULL AND indexprs IS NULL AND amname = 'btree'
          AND COALESCE(indisunique, false) = is_unique
          AND COALESCE(indnatts, -1) = cardinality(key_columns)
          AND COALESCE(indnkeyatts, -1) = cardinality(key_columns)
          AND actual_key_columns = key_columns
        )
        FROM actual_indexes
      ) AS analytics_indexes,
      (
        SELECT count(*) = 3 AND bool_and(
          contype = 'f'
          AND confdeltype = 'r'
          AND confupdtype = 'c'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = child_oid AND attname = child_column AND NOT attisdropped)]::smallint[]
          AND confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = parent_oid AND attname = 'id' AND NOT attisdropped)]::smallint[]
          AND confrelid = parent_oid
          AND conrelid = child_oid
        )
        FROM actual_fks
      ) AS analytics_foreign_keys,
      (
        SELECT count(*) = 3 AND bool_and(
          (constraint_row.contype = 'p' AND constraint_row.conname IN ('ReferralClickDailyVisitor_pkey', 'ReferralConversion_pkey'))
          OR (constraint_row.contype = 'c' AND constraint_row.conname = 'ReferralClickDailyVisitor_clickCount_check'
            AND lower(regexp_replace(pg_get_expr(constraint_row.conbin, constraint_row.conrelid), '[^a-zA-Z0-9<>=]+', '', 'g')) = 'clickcount>0')
        )
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND constraint_row.conname IN (
            'ReferralClickDailyVisitor_pkey',
            'ReferralClickDailyVisitor_clickCount_check',
            'ReferralConversion_pkey'
          )
      ) AS analytics_constraints,
      (
        SELECT count(*) = 2
        FROM pg_class table_row
        JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
        WHERE schema_row.nspname = 'public'
          AND table_row.relname IN ('ReferralClickDailyVisitor', 'ReferralConversion')
          AND table_row.relrowsecurity IS TRUE
      ) AS analytics_rls,
      NOT EXISTS (
        SELECT 1
        FROM (VALUES ('anon'::name), ('authenticated'::name)) roles(role_name)
        CROSS JOIN (VALUES ('ReferralClickDailyVisitor'::text), ('ReferralConversion'::text)) tables(table_name)
        CROSS JOIN (VALUES ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text), ('TRUNCATE'::text), ('REFERENCES'::text), ('TRIGGER'::text)) privileges(privilege_name)
        WHERE has_table_privilege(roles.role_name, format('public.%I', tables.table_name), privileges.privilege_name)
      ) AS analytics_public_access_revoked
  `);
  return result.rows[0] ?? null;
}

export async function queryAnalyticsMigrationInitialState(client) {
  const result = await client.query(`
    SELECT (SELECT count(*) = 0 FROM public."ReferralClickDailyVisitor") AS analytics_click_zero_rows
  `);
  return result.rows[0] ?? null;
}

function allEvidencePresent(evidence, keys) {
  return Boolean(evidence) && keys.every((key) => evidence[key] === true);
}

const PREREQUISITE_PREFLIGHT_KEYS = [
  "partner_profile_table",
  "partner_profile_id_text",
  "partner_profile_id_key",
  "user_profile_table",
  "user_profile_id_text",
  "user_profile_id_key",
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

const TARGET_SCHEMA_KEYS = [
  "target_enum_values",
  "target_event_type_enum",
  "target_user_profile_table",
  "target_user_profile_id_text",
  "target_user_profile_id_key",
  "target_settlement_leg_status",
  "target_settlement_leg_hold_until",
  "target_settlement_reversal_status",
  "target_columns",
  "target_hold_reason_check",
  "target_leg_retry_check",
  "target_reversal_retry_check",
  "target_approval_fk",
  "target_indexes",
];

const FIRST_MIGRATION_PREFLIGHT_KEYS = [
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

const FIRST_MIGRATION_SCHEMA_KEYS = [
  "first_source_type_enum",
  "first_requested_amount",
  "first_successfully_reversed_amount",
  "first_source_type_column",
  "first_stripe_source_object_id",
  "first_original_transfer_id",
  "first_requested_amount_check",
  "first_successfully_reversed_amount_check",
  "first_source_index",
];

const SECOND_MIGRATION_SCHEMA_KEYS = [
  "second_status_values",
  "second_manual_requeue_count",
  "second_manual_requeue_check",
  "second_status_index",
  "second_status_constraint",
  "second_rls",
  "second_public_access_revoked",
];

const MERCHANT_MIGRATION_SCHEMA_KEYS = [
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

const OPERATIONS_MIGRATION_PREFLIGHT_KEYS = [
  "operations_payment_flow_absent",
  "operations_leg_manual_review_absent",
  "operations_tables_absent",
  "operations_enum_types_absent",
];

const OPERATIONS_MIGRATION_SCHEMA_KEYS = [
  "operations_enum_types",
  "operations_enum_values",
  "operations_payment_flow_column",
  "operations_leg_manual_review",
  "operations_tables",
  "operations_worker_columns",
  "operations_alert_columns",
  "operations_indexes",
  "operations_constraints",
  "operations_restrictive_fks",
  "operations_rls",
  "operations_public_access_revoked",
];

const OPERATIONS_MIGRATION_INITIAL_STATE_KEYS = [
  "operations_worker_run_zero_rows",
  "operations_alert_zero_rows",
];

const ANALYTICS_MIGRATION_PREFLIGHT_KEYS = [
  "analytics_partner_profile_table",
  "analytics_referral_attribution_table",
  "analytics_subject_type_enum",
  "analytics_tables_absent",
  "analytics_indexes_absent",
];

const ANALYTICS_MIGRATION_SCHEMA_KEYS = [
  "analytics_tables",
  "analytics_columns",
  "analytics_indexes",
  "analytics_foreign_keys",
  "analytics_constraints",
  "analytics_rls",
  "analytics_public_access_revoked",
];

const ANALYTICS_MIGRATION_INITIAL_STATE_KEYS = [
  "analytics_click_zero_rows",
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
        assertMigrationApplied(beforeRecords, RELEASE_APPROVAL_MIGRATION);
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

      try {
        assertMigrationApplied(beforeRecords, FIRST_APPROVED_MIGRATION);
        const firstSchema = await queryFirstMigrationSchema(client);
        if (!allEvidencePresent(firstSchema, FIRST_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("First migration schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }

      try {
        assertMigrationApplied(beforeRecords, TARGET_MIGRATION);
        const secondSchema = await querySecondMigrationSchema(client);
        if (!allEvidencePresent(secondSchema, SECOND_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("Second migration schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }

      try {
        assertMigrationApplied(beforeRecords, MERCHANT_MIGRATION);
        const merchantSchema = await queryMerchantMigrationSchema(client);
        if (!allEvidencePresent(merchantSchema, MERCHANT_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("Merchant schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }

      try {
        assertMigrationApplied(beforeRecords, OPERATIONS_MIGRATION);
        const operationsSchema = await queryOperationsMigrationSchema(client);
        if (!allEvidencePresent(operationsSchema, OPERATIONS_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("Settlement operations schema verification failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }

      try {
        assertMigrationApplied(beforeRecords, ANALYTICS_MIGRATION);
        const analyticsSchema = await queryAnalyticsMigrationSchema(client);
        if (!allEvidencePresent(analyticsSchema, ANALYTICS_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("Partner referral analytics schema verification failed.");
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
      assertMigrationApplied(beforeRecords, RELEASE_APPROVAL_MIGRATION);
      const releaseApprovalSchema = await queryTargetSchema(client);
      if (!allEvidencePresent(releaseApprovalSchema, TARGET_SCHEMA_KEYS)) {
        throw new Error("Release approval schema preflight failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "migration_state_evaluation",
        source,
        "target_preflight_failed",
      );
    }

    if (state.pendingMigrations.includes(FIRST_APPROVED_MIGRATION)) {
      try {
        const firstPreflight = await queryFirstMigrationPreflight(client);
        if (!allEvidencePresent(firstPreflight, FIRST_MIGRATION_PREFLIGHT_KEYS)) {
          throw new Error("First migration preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
    } else {
      try {
        assertMigrationApplied(beforeRecords, FIRST_APPROVED_MIGRATION);
        const firstSchema = await queryFirstMigrationSchema(client);
        if (!allEvidencePresent(firstSchema, FIRST_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("First migration recovery preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
    }

    try {
      assertMigrationApplied(beforeRecords, TARGET_MIGRATION);
      const secondSchema = await querySecondMigrationSchema(client);
      if (!allEvidencePresent(secondSchema, SECOND_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Second migration schema preflight failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "migration_state_evaluation",
        source,
        "target_preflight_failed",
      );
    }

    try {
      assertMigrationApplied(beforeRecords, MERCHANT_MIGRATION);
      const merchantSchema = await queryMerchantMigrationSchema(client);
      if (!allEvidencePresent(merchantSchema, MERCHANT_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Merchant schema preflight failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "migration_state_evaluation",
        source,
        "target_preflight_failed",
      );
    }

    if (state.pendingMigrations.includes(OPERATIONS_MIGRATION)) {
      try {
        const operationsPreflight = await queryOperationsMigrationPreflight(client);
        if (!allEvidencePresent(operationsPreflight, OPERATIONS_MIGRATION_PREFLIGHT_KEYS)) {
          throw new Error("Settlement operations migration preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
    } else {
      try {
        assertMigrationApplied(beforeRecords, OPERATIONS_MIGRATION);
        const operationsSchema = await queryOperationsMigrationSchema(client);
        if (!allEvidencePresent(operationsSchema, OPERATIONS_MIGRATION_SCHEMA_KEYS)) {
          throw new Error("Settlement operations schema recovery preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
    }

    if (state.pendingMigrations.includes(ANALYTICS_MIGRATION)) {
      try {
        const analyticsPreflight = await queryAnalyticsMigrationPreflight(client);
        if (!allEvidencePresent(analyticsPreflight, ANALYTICS_MIGRATION_PREFLIGHT_KEYS)) {
          throw new Error("Partner referral analytics migration preflight failed.");
        }
      } catch {
        throw new ProductionMigrationDiagnostic(
          "migration_state_evaluation",
          source,
          "target_preflight_failed",
        );
      }
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
      assertMigrationApplied(afterRecords, RELEASE_APPROVAL_MIGRATION);
      const releaseApprovalSchema = await queryTargetSchema(client);
      if (!allEvidencePresent(releaseApprovalSchema, TARGET_SCHEMA_KEYS)) {
        throw new Error("Release approval post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "prerequisite_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, FIRST_APPROVED_MIGRATION);
      const firstSchema = await queryFirstMigrationSchema(client);
      if (!allEvidencePresent(firstSchema, FIRST_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("First migration post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "target_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, TARGET_MIGRATION);
      const secondSchema = await querySecondMigrationSchema(client);
      if (!allEvidencePresent(secondSchema, SECOND_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Second migration post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "target_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, MERCHANT_MIGRATION);
      const merchantSchema = await queryMerchantMigrationSchema(client);
      if (!allEvidencePresent(merchantSchema, MERCHANT_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Merchant migration post-verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "target_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, OPERATIONS_MIGRATION);
      const operationsSchema = await queryOperationsMigrationSchema(client);
      if (!allEvidencePresent(operationsSchema, OPERATIONS_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Settlement operations schema post-verification failed.");
      }
      const operationsInitialState = await queryOperationsMigrationInitialState(client);
      if (!allEvidencePresent(operationsInitialState, OPERATIONS_MIGRATION_INITIAL_STATE_KEYS)) {
        throw new Error("Settlement operations initial state verification failed.");
      }
    } catch {
      throw new ProductionMigrationDiagnostic(
        "target_verification",
        source,
        "target_postverify_failed",
      );
    }

    try {
      assertMigrationApplied(afterRecords, ANALYTICS_MIGRATION);
      const analyticsSchema = await queryAnalyticsMigrationSchema(client);
      if (!allEvidencePresent(analyticsSchema, ANALYTICS_MIGRATION_SCHEMA_KEYS)) {
        throw new Error("Partner referral analytics schema post-verification failed.");
      }
      const analyticsInitialState = await queryAnalyticsMigrationInitialState(client);
      if (!allEvidencePresent(analyticsInitialState, ANALYTICS_MIGRATION_INITIAL_STATE_KEYS)) {
        throw new Error("Partner referral analytics initial state verification failed.");
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
