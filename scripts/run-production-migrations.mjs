import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

export const PRODUCTION_ENVIRONMENT = "production";
export const EXPECTED_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
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

function migrationState(localMigrationNames, databaseRecords, schemaEvidence) {
  const localNames = new Set(localMigrationNames);
  const databaseNames = new Set();

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
    if (!databaseNames.has(TARGET_MIGRATION)) {
      throw new Error("The allowlisted production migration is not recorded.");
    }
    return { action: "skip", pendingMigrations };
  }

  if (pendingMigrations.length !== 1 || pendingMigrations[0] !== TARGET_MIGRATION) {
    throw new Error("Production has an unexpected pending migration.");
  }

  return { action: "deploy", pendingMigrations };
}

function assertTargetApplied(databaseRecords) {
  const targetRecords = databaseRecords.filter((record) => record.migration_name === TARGET_MIGRATION);
  if (targetRecords.length !== 1) {
    throw new Error("The allowlisted production migration was not applied exactly once.");
  }

  const [target] = targetRecords;
  if (target.finished_at === null || target.rolled_back_at !== null || Number(target.applied_steps_count) !== 1) {
    throw new Error("The allowlisted production migration failed verification.");
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
    try {
      state = migrationState(
        localMigrationNames ?? readLocalMigrationNames(),
        beforeRecords,
        schemaEvidence,
      );
    } catch {
      throw new ProductionMigrationDiagnostic("migration_state_evaluation", source);
    }

    if (state.action === "skip") {
      return "already-applied";
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
      assertTargetApplied(afterRecords);
    } catch {
      throw new ProductionMigrationDiagnostic("target_verification", source);
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
