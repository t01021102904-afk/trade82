import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const TRANSLATION_SYSTEM_PROMPT =
  "Translate Korean seller-entered B2B marketplace content into natural, professional English for global wholesale buyers. Preserve brand names, company names, ingredient names, certifications, model numbers, HS codes, sizes, quantities, SKUs, and proper nouns. Do not add unsupported claims. For cosmetics, avoid cure, treat, heal, guaranteed results, or medical claims. For food and supplements, avoid disease-treatment claims. Keep the translation faithful, concise, export-facing, and suitable for Trade82.";

type ProductTranslation = {
  nameEn: string;
  shortDescriptionEn: string;
  detailedDescriptionEn: string;
  buyerNotesEn: string;
  tagsEn: string[];
};

type CompanyTranslation = {
  displayNameEn: string;
  descriptionEn: string;
  exportExperienceEn: string;
};

type ProductRecord = {
  id: string;
  name: string;
  nameEn: string;
  tags: string[];
  tagsEn: string[];
  shortDescription: string;
  shortDescriptionEn: string;
  detailedDescription: string;
  detailedDescriptionEn: string;
  buyerNotes: string;
  buyerNotesEn: string;
};

type CompanyRecord = {
  id: string;
  legalName: string;
  tradeName: string | null;
  displayNameEn: string;
  description: string;
  descriptionEn: string;
  sellerProfile: {
    exportExperience: string;
    exportExperienceEn: string;
  } | null;
};

type PrismaLike = {
  product: {
    findMany: (args: unknown) => Promise<ProductRecord[]>;
    update: (args: unknown) => Promise<unknown>;
  };
  company: {
    findMany: (args: unknown) => Promise<CompanyRecord[]>;
    update: (args: unknown) => Promise<unknown>;
  };
  sellerProfile: {
    update: (args: unknown) => Promise<unknown>;
  };
  $disconnect: () => Promise<void>;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const clientModule = await import(
    pathToFileURL(path.join(process.cwd(), "src/generated/prisma/client.ts")).href
  );
  const { PrismaClient } = clientModule as {
    PrismaClient: new (options: { adapter: PrismaPg }) => PrismaLike;
  };
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 1) || 1,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    console.log(
      `Backfill English content ${options.dryRun ? "dry run" : "write mode"} · limit ${options.limit}`,
    );
    const productCount = await backfillProducts({
      prisma,
      apiKey,
      limit: options.limit,
      dryRun: options.dryRun,
    });
    const companyCount = await backfillCompanies({
      prisma,
      apiKey,
      limit: Math.max(options.limit - productCount, 0),
      dryRun: options.dryRun,
    });
    console.log(`Processed ${productCount} products and ${companyCount} companies.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function backfillProducts({
  prisma,
  apiKey,
  limit,
  dryRun,
}: {
  prisma: PrismaLike;
  apiKey: string;
  limit: number;
  dryRun: boolean;
}) {
  if (limit <= 0) return 0;
  const products = (await prisma.product.findMany({
    where: {
      OR: [
        { nameEn: "" },
        { shortDescriptionEn: "" },
        { detailedDescriptionEn: "" },
        { buyerNotesEn: "" },
        { tagsEn: { isEmpty: true } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })) as ProductRecord[];

  let processed = 0;
  for (const product of products) {
    if (!hasProductSource(product)) continue;
    const translation = await translate<ProductTranslation>({
      apiKey,
      schema: productSchema(),
      schemaName: "trade82_product_english_translation",
      prompt: {
        task: "Generate English fields for Trade82 product content.",
        source: {
          name: product.name,
          shortDescription: product.shortDescription,
          detailedDescription: product.detailedDescription,
          buyerNotes: product.buyerNotes,
          tags: product.tags,
        },
      },
    });
    const data: Partial<ProductTranslation> = {};
    if (!product.nameEn.trim() && translation.nameEn) data.nameEn = cleanText(translation.nameEn, 120);
    if (!product.shortDescriptionEn.trim() && translation.shortDescriptionEn) {
      data.shortDescriptionEn = cleanText(translation.shortDescriptionEn, 240);
    }
    if (!product.detailedDescriptionEn.trim() && translation.detailedDescriptionEn) {
      data.detailedDescriptionEn = cleanText(translation.detailedDescriptionEn, 5_000);
    }
    if (!product.buyerNotesEn.trim() && translation.buyerNotesEn) {
      data.buyerNotesEn = cleanText(translation.buyerNotesEn, 1_000);
    }
    if (!product.tagsEn.length && translation.tagsEn?.length) {
      data.tagsEn = cleanTags(translation.tagsEn);
    }
    if (!Object.keys(data).length) continue;

    console.log(`${dryRun ? "Would update" : "Updating"} product ${product.id}: ${product.name}`);
    if (!dryRun) {
      await prisma.product.update({ where: { id: product.id }, data });
    }
    processed += 1;
  }
  return processed;
}

async function backfillCompanies({
  prisma,
  apiKey,
  limit,
  dryRun,
}: {
  prisma: PrismaLike;
  apiKey: string;
  limit: number;
  dryRun: boolean;
}) {
  if (limit <= 0) return 0;
  const companies = (await prisma.company.findMany({
    where: {
      companyRole: "seller",
      OR: [
        { displayNameEn: "" },
        { descriptionEn: "" },
        { sellerProfile: { is: { exportExperienceEn: "" } } },
      ],
    },
    include: { sellerProfile: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  })) as CompanyRecord[];

  let processed = 0;
  for (const company of companies) {
    if (!hasCompanySource(company)) continue;
    const translation = await translate<CompanyTranslation>({
      apiKey,
      schema: companySchema(),
      schemaName: "trade82_company_english_translation",
      prompt: {
        task: "Generate English fields for Trade82 seller company content.",
        source: {
          companyName: company.tradeName || company.legalName,
          description: company.description,
          exportExperience: company.sellerProfile?.exportExperience ?? "",
        },
      },
    });
    const companyData: Partial<CompanyTranslation> = {};
    const sellerData: Pick<CompanyTranslation, "exportExperienceEn"> | null =
      company.sellerProfile &&
      !company.sellerProfile.exportExperienceEn.trim() &&
      translation.exportExperienceEn
        ? { exportExperienceEn: cleanText(translation.exportExperienceEn, 10_000) }
        : null;

    if (!company.displayNameEn.trim() && translation.displayNameEn) {
      companyData.displayNameEn = cleanText(translation.displayNameEn, 160);
    }
    if (!company.descriptionEn.trim() && translation.descriptionEn) {
      companyData.descriptionEn = cleanText(translation.descriptionEn, 2_000);
    }
    if (!Object.keys(companyData).length && !sellerData) continue;

    console.log(`${dryRun ? "Would update" : "Updating"} company ${company.id}: ${company.tradeName || company.legalName}`);
    if (!dryRun) {
      await prisma.company.update({ where: { id: company.id }, data: companyData });
      if (sellerData) {
        await prisma.sellerProfile.update({
          where: { companyId: company.id },
          data: sellerData,
        });
      }
    }
    processed += 1;
  }
  return processed;
}

async function translate<T>({
  apiKey,
  schema,
  schemaName,
  prompt,
}: {
  apiKey: string;
  schema: Record<string, unknown>;
  schemaName: string;
  prompt: Record<string, unknown>;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-5-mini",
      instructions: TRANSLATION_SYSTEM_PROMPT,
      input: JSON.stringify(prompt, null, 2),
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
      store: false,
      max_output_tokens: 1400,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    output_text?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "OpenAI translation request failed.",
    );
  }
  const outputText = typeof body?.output_text === "string" ? body.output_text : "";
  if (!outputText) throw new Error("OpenAI translation response was empty.");
  return JSON.parse(outputText) as T;
}

function parseArgs(args: string[]) {
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 10;
  return {
    dryRun,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10,
  };
}

function hasProductSource(product: ProductRecord) {
  return Boolean(
    product.name.trim() ||
      product.shortDescription.trim() ||
      product.detailedDescription.trim() ||
      product.buyerNotes.trim() ||
      product.tags.length,
  );
}

function hasCompanySource(company: CompanyRecord) {
  return Boolean(
    company.legalName.trim() ||
      company.tradeName?.trim() ||
      company.description.trim() ||
      company.sellerProfile?.exportExperience.trim(),
  );
}

function productSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      nameEn: { type: "string" },
      shortDescriptionEn: { type: "string" },
      detailedDescriptionEn: { type: "string" },
      buyerNotesEn: { type: "string" },
      tagsEn: { type: "array", items: { type: "string" }, maxItems: 10 },
    },
    required: [
      "nameEn",
      "shortDescriptionEn",
      "detailedDescriptionEn",
      "buyerNotesEn",
      "tagsEn",
    ],
  };
}

function companySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      displayNameEn: { type: "string" },
      descriptionEn: { type: "string" },
      exportExperienceEn: { type: "string" },
    },
    required: ["displayNameEn", "descriptionEn", "exportExperienceEn"],
  };
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item.replace(/^#/, ""), 30))
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
