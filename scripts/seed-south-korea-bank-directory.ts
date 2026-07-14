import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { SOUTH_KOREAN_BANK_DIRECTORY_SEED } from "../src/lib/south-korea-bank-directory.ts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");

  const clientModule = await import(
    pathToFileURL(path.join(process.cwd(), "src/generated/prisma/client.ts")).href,
  );
  const { PrismaClient } = clientModule as {
    PrismaClient: new (options: { adapter: PrismaPg }) => {
      bankDirectory: {
        upsert(args: unknown): Promise<unknown>;
      };
      $disconnect(): Promise<void>;
    };
  };
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    for (const bank of SOUTH_KOREAN_BANK_DIRECTORY_SEED) {
      await prisma.bankDirectory.upsert({
        where: {
          countryCode_bankNameEnglish: {
            countryCode: bank.countryCode,
            bankNameEnglish: bank.bankNameEnglish,
          },
        },
        create: {
          ...bank,
          isActive: true,
          sourceType: "SEED",
          // Leave all remittance metadata unverified and null until an admin
          // records a bank-owned source URL and verification date.
        },
        update: {},
      });
    }
    console.log(`Seeded ${SOUTH_KOREAN_BANK_DIRECTORY_SEED.length} Korean bank names without overwriting existing records.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Bank directory seed failed.");
  process.exitCode = 1;
});
