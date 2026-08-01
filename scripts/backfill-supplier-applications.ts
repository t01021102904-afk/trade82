import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type LegacyCompany = {
  id: string;
  ownerUserId: string;
  legalName: string;
  tradeName: string | null;
  website: string;
  country: string;
  verificationStatus: string;
  sellerProfile: { id: string } | null;
  sellerPayoutProfile: { status: string } | null;
  owner: { displayName: string; email: string; phoneNumber: string };
};

type PrismaLike = {
  company: { findMany(args: unknown): Promise<LegacyCompany[]> };
  supplierApplication: { findMany(args: unknown): Promise<Array<{ legacyCompanyId: string | null }>>; create(args: unknown): Promise<unknown> };
  $transaction<T>(callback: (tx: PrismaLike) => Promise<T>): Promise<T>;
  $disconnect(): Promise<void>;
};

type Classification = "LEGACY_CONDITIONALLY_APPROVED" | "REVERIFICATION_REQUIRED" | "APPLICATION_REQUIRED";

function parseArgs(args: string[]) {
  const apply = args.includes("--apply");
  if (args.some((arg) => arg !== "--apply" && arg !== "--dry-run")) {
    throw new Error("Usage: npm run backfill:supplier-applications -- [--dry-run|--apply]");
  }
  return { apply };
}

export function classifyLegacySeller(company: LegacyCompany): Classification {
  if (company.verificationStatus === "verified" && company.sellerProfile) return "LEGACY_CONDITIONALLY_APPROVED";
  if (company.verificationStatus === "needs_reverification" || company.verificationStatus === "pending_review" || !company.sellerProfile || !company.sellerPayoutProfile) return "REVERIFICATION_REQUIRED";
  return "APPLICATION_REQUIRED";
}

function applicationStatus(classification: Classification) {
  return classification === "LEGACY_CONDITIONALLY_APPROVED" ? "CONDITIONALLY_APPROVED" : "DRAFT";
}

function nameParts(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "Legacy", lastName: parts.slice(1).join(" ") || "Applicant" };
}

function websiteDomain(website: string) {
  try { return new URL(website).hostname.toLowerCase(); } catch { return null; }
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (
    process.env.SUPPLIER_APPLICATIONS_ENABLED?.trim().toLowerCase() !== "true"
  ) {
    throw new Error(
      "SUPPLIER_APPLICATIONS_ENABLED=true is required before querying the backfill tables.",
    );
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  if (apply && (process.env.VERCEL_ENV === "production" || databaseUrl.includes("cjryteuoyiiwsxarblfd"))) {
    throw new Error("Refusing to apply the supplier backfill to Production. Use a staging or development database only.");
  }
  if (apply && process.env.SUPPLIER_APPLICATION_BACKFILL_CONFIRM !== "staging") {
    throw new Error("Set SUPPLIER_APPLICATION_BACKFILL_CONFIRM=staging before using --apply.");
  }

  const clientModule = await import(pathToFileURL(path.join(process.cwd(), "src/generated/prisma/client.ts")).href);
  const { PrismaClient } = clientModule as { PrismaClient: new (options: { adapter: PrismaPg }) => PrismaLike };
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const [companies, existing] = await Promise.all([
      prisma.company.findMany({ where: { companyRole: "seller", deletedAt: null }, include: { sellerProfile: { select: { id: true } }, sellerPayoutProfile: { select: { status: true } }, owner: { select: { displayName: true, email: true, phoneNumber: true } } } }),
      prisma.supplierApplication.findMany({ where: { legacyCompanyId: { not: null } }, select: { legacyCompanyId: true } }),
    ]);
    const existingCompanyIds = new Set(existing.flatMap((item) => item.legacyCompanyId ? [item.legacyCompanyId] : []));
    const candidates = companies.filter((company) => !existingCompanyIds.has(company.id));
    const summary = candidates.reduce<Record<Classification, number>>((counts, company) => { const classification = classifyLegacySeller(company); counts[classification] += 1; return counts; }, { LEGACY_CONDITIONALLY_APPROVED: 0, REVERIFICATION_REQUIRED: 0, APPLICATION_REQUIRED: 0 });
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", existingApplications: existingCompanyIds.size, candidates: candidates.length, summary }, null, 2));
    if (!apply) return;

    for (const company of candidates) {
      const classification = classifyLegacySeller(company);
      const contact = nameParts(company.owner.displayName);
      await prisma.$transaction((tx) => tx.supplierApplication.create({
        data: {
          applicationNumber: `T82-LEGACY-${company.id.toUpperCase()}`,
          applicantUserId: company.ownerUserId,
          legacyCompanyId: company.id,
          status: applicationStatus(classification),
          legalCompanyName: company.legalName || "Legacy supplier",
          tradeName: company.tradeName,
          companyWebsite: company.website || "https://legacy.trade82.invalid",
          websiteDomain: websiteDomain(company.website),
          registrationCountry: company.country || "Unknown",
          legacyClassification: classification,
          legacyBackfilledAt: new Date(),
          contacts: { create: { ...contact, jobTitle: "Legacy seller contact", workEmail: company.owner.email, phoneNumber: company.owner.phoneNumber || "Not provided", isPrimary: true } },
          statusHistory: { create: { toStatus: applicationStatus(classification), actorType: "SYSTEM", reason: "Idempotent legacy seller onboarding backfill." } },
          auditEvents: { create: { action: "LEGACY_BACKFILLED", before: {}, after: { classification, dryRun: false } } },
        },
      }));
    }
    console.log(`Created ${candidates.length} supplier application records.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : "Supplier backfill failed."); process.exitCode = 1; });
