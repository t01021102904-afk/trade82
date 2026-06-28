import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function getDatabasePoolMax() {
  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 1);
  return Number.isFinite(configuredMax) && configuredMax >= 1
    ? Math.floor(configuredMax)
    : 1;
}

function getPgPool() {
  if (globalForPrisma.pgPool) {
    return globalForPrisma.pgPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pool = new Pool({
    connectionString,
    max: getDatabasePoolMax(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });

  pool.on("error", (error) => {
    console.error("Postgres pool idle client error.", {
      name: error.name,
    });
  });

  globalForPrisma.pgPool = pool;
  return pool;
}

export function getDb() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(getPgPool()),
  });

  globalForPrisma.prisma = prisma;

  return prisma;
}
