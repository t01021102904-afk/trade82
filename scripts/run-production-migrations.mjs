import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

export const PRODUCTION_ENVIRONMENT = "production";
export const EXPECTED_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
export const TARGET_MIGRATION = "20260717120000_add_settlement_release_approval";

const MIGRATION_DIRECTORY = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));

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

function isSuccessfulMigrationRecord(record) {
  return record.finished_at !== null
    && record.rolled_back_at === null
    && Number(record.applied_steps_count) >= 1;
}

function migrationState(localMigrationNames, databaseRecords) {
  const localNames = new Set(localMigrationNames);
  const databaseNames = new Set();

  for (const record of databaseRecords) {
    if (typeof record.migration_name !== "string" || databaseNames.has(record.migration_name)) {
      throw new Error("Production migration history is invalid.");
    }
    databaseNames.add(record.migration_name);

    if (!isSuccessfulMigrationRecord(record)) {
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

function createProductionClient(connectionString) {
  return new Client({ connectionString });
}

function deployCommittedMigrations(environment) {
  execFileSync("npm", ["run", "db:deploy"], {
    env: environment,
    stdio: "ignore",
  });
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

  const connectionString = environment.DIRECT_URL ?? environment.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Production database migrations require DIRECT_URL or DATABASE_URL.");
  }
  if (!isExpectedSupabaseConnection(connectionString)) {
    throw new Error("Production database is not the expected Trade82 Supabase project.");
  }

  const client = createClient(connectionString);
  try {
    await client.connect();
    const beforeRecords = await queryMigrationRecords(client);
    const state = migrationState(localMigrationNames ?? readLocalMigrationNames(), beforeRecords);

    if (state.action === "skip") {
      return "already-applied";
    }

    deploy(environment);
    const afterRecords = await queryMigrationRecords(client);
    assertTargetApplied(afterRecords);
    return "deployed";
  } finally {
    await client.end().catch(() => {});
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
  } catch {
    console.error("Production database migration verification failed.");
    process.exitCode = 1;
  }
}
