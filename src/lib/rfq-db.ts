import "server-only";

import { randomUUID } from "crypto";

import { Prisma } from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
import {
  canCancelRfq,
  canEditRfq,
  normalizeRfqMatchReason,
  type RfqMatchReasonCode,
  type RfqAdminStatus,
  type RfqFormValue,
  type RfqRecord,
  type RfqSuggestedMatch,
  type RfqStatus,
} from "@/lib/rfq";

type RfqInput = {
  productName: string;
  category: string;
  sourcingType: string;
  sourcingPurpose: string | null;
  quantity: string;
  tradeTerms: string;
  destinationCountry: string | null;
  preferredUnitPriceAmount: string | null;
  preferredUnitPriceCurrency: "USD" | "KRW" | null;
  shape: string | null;
  capacity: string | null;
  material: string | null;
  certification: string | null;
  feature: string | null;
  targetDeliveryDate: string | null;
  details: string;
};

type RfqRow = Omit<
  RfqRecord,
  "createdAt" | "updatedAt" | "targetDeliveryDate" | "reviewedAt"
> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  targetDeliveryDate: Date | string | null;
  reviewedAt: Date | string | null;
};

type RfqMatchedProductRow = {
  id: string;
  productId: string;
  rank: number;
  reasons: string[];
};

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeRfq(row: RfqRow): RfqRecord {
  return {
    ...row,
    targetDeliveryDate: toIso(row.targetDeliveryDate),
    reviewedAt: toIso(row.reviewedAt),
    createdAt: toIso(row.createdAt) ?? "",
    updatedAt: toIso(row.updatedAt) ?? "",
  };
}

async function serializeRfqWithMatches(row: RfqRow): Promise<RfqRecord> {
  return {
    ...serializeRfq(row),
    suggestedMatches: await listSuggestedMatches(row.id),
  };
}

function textField(
  source: Record<string, unknown>,
  key: keyof RfqFormValue,
  options: { required?: boolean; max: number },
) {
  const value = source[key];
  if (value === undefined || value === null) {
    if (options.required) throw validationError(`${key} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    throw validationError(`${key} must be text.`);
  }
  const text = value.trim();
  if (options.required && !text) {
    throw validationError(`${key} is required.`);
  }
  if (text.length > options.max) {
    throw validationError(`${key} is too long.`);
  }
  return text;
}

function optionalTextField(
  source: Record<string, unknown>,
  key: keyof RfqFormValue,
  max = 500,
) {
  return textField(source, key, { max }) || null;
}

function preferredAmountField(source: Record<string, unknown>) {
  const raw = source.preferredUnitPriceAmount;
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw validationError("preferredUnitPriceAmount must be a number.");
  }
  const value = String(raw).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw validationError("preferredUnitPriceAmount must be a valid price.");
  }
  return value;
}

function currencyField(source: Record<string, unknown>, hasAmount: boolean) {
  if (!hasAmount) return null;
  const value = String(source.preferredUnitPriceCurrency ?? "USD").trim();
  if (value !== "USD" && value !== "KRW") {
    throw validationError("preferredUnitPriceCurrency is invalid.");
  }
  return value;
}

function targetDeliveryDateField(source: Record<string, unknown>) {
  const value = textField(source, "targetDeliveryDate", { max: 32 });
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError("targetDeliveryDate must be YYYY-MM-DD.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw validationError("targetDeliveryDate is invalid.");
  }
  return date.toISOString();
}

export function validateRfqInput(source: Record<string, unknown>): RfqInput {
  const preferredUnitPriceAmount = preferredAmountField(source);
  return {
    productName: textField(source, "productName", { required: true, max: 180 }),
    category: textField(source, "category", { required: true, max: 120 }),
    sourcingType: textField(source, "sourcingType", { required: true, max: 120 }),
    sourcingPurpose: optionalTextField(source, "sourcingPurpose", 160),
    quantity: textField(source, "quantity", { required: true, max: 160 }),
    tradeTerms: textField(source, "tradeTerms", { required: true, max: 120 }),
    destinationCountry: optionalTextField(source, "destinationCountry", 120),
    preferredUnitPriceAmount,
    preferredUnitPriceCurrency: currencyField(
      source,
      Boolean(preferredUnitPriceAmount),
    ),
    shape: optionalTextField(source, "shape", 160),
    capacity: optionalTextField(source, "capacity", 160),
    material: optionalTextField(source, "material", 240),
    certification: optionalTextField(source, "certification", 240),
    feature: optionalTextField(source, "feature", 240),
    targetDeliveryDate: targetDeliveryDateField(source),
    details: textField(source, "details", { required: true, max: 8_000 }),
  };
}

export async function listBuyerRfqs(buyerUserId: string) {
  const rows = await getDb().$queryRaw<RfqRow[]>`
    SELECT r.*, buyer."displayName" AS "buyerName", buyer."email" AS "buyerEmail",
      company."legalName" AS "buyerCompanyName"
    FROM "RfqRequest" r
    JOIN "UserProfile" buyer ON buyer."id" = r."buyerUserId"
    LEFT JOIN "Company" company ON company."id" = r."buyerCompanyId"
    WHERE r."buyerUserId" = ${buyerUserId}
    ORDER BY r."createdAt" DESC
  `;
  return rows.map(serializeRfq);
}

export async function getBuyerRfq(buyerUserId: string, id: string) {
  const rows = await getDb().$queryRaw<RfqRow[]>`
    SELECT r.*, buyer."displayName" AS "buyerName", buyer."email" AS "buyerEmail",
      company."legalName" AS "buyerCompanyName"
    FROM "RfqRequest" r
    JOIN "UserProfile" buyer ON buyer."id" = r."buyerUserId"
    LEFT JOIN "Company" company ON company."id" = r."buyerCompanyId"
    WHERE r."id" = ${id} AND r."buyerUserId" = ${buyerUserId}
    LIMIT 1
  `;
  return rows[0] ? serializeRfqWithMatches(rows[0]) : null;
}

export async function createBuyerRfq({
  buyerUserId,
  buyerCompanyId,
  input,
}: {
  buyerUserId: string;
  buyerCompanyId: string | null;
  input: RfqInput;
}) {
  const id = randomUUID();
  await getDb().$executeRaw`
    INSERT INTO "RfqRequest" (
      "id", "buyerUserId", "buyerCompanyId", "productName", "category",
      "sourcingType", "sourcingPurpose", "quantity", "tradeTerms",
      "destinationCountry", "preferredUnitPriceAmount", "preferredUnitPriceCurrency",
      "shape", "capacity", "material", "certification", "feature",
      "targetDeliveryDate", "details", "updatedAt"
    ) VALUES (
      ${id}, ${buyerUserId}, ${buyerCompanyId}, ${input.productName}, ${input.category},
      ${input.sourcingType}, ${input.sourcingPurpose}, ${input.quantity}, ${input.tradeTerms},
      ${input.destinationCountry}, CAST(${input.preferredUnitPriceAmount} AS DECIMAL(14,2)), ${input.preferredUnitPriceCurrency},
      ${input.shape}, ${input.capacity}, ${input.material}, ${input.certification}, ${input.feature},
      CAST(${input.targetDeliveryDate} AS TIMESTAMP(3)), ${input.details}, CURRENT_TIMESTAMP
    )
  `;
  const rfq = await getBuyerRfq(buyerUserId, id);
  if (!rfq) throw new Response("RFQ could not be created.", { status: 500 });
  return rfq;
}

export async function updateBuyerRfq({
  buyerUserId,
  id,
  input,
}: {
  buyerUserId: string;
  id: string;
  input: RfqInput;
}) {
  const existing = await getBuyerRfq(buyerUserId, id);
  if (!existing) throw new Response("RFQ not found.", { status: 404 });
  if (!canEditRfq(existing.status)) {
    throw new Response("This RFQ can no longer be edited.", { status: 403 });
  }

  await getDb().$executeRaw`
    UPDATE "RfqRequest"
    SET "productName" = ${input.productName},
      "category" = ${input.category},
      "sourcingType" = ${input.sourcingType},
      "sourcingPurpose" = ${input.sourcingPurpose},
      "quantity" = ${input.quantity},
      "tradeTerms" = ${input.tradeTerms},
      "destinationCountry" = ${input.destinationCountry},
      "preferredUnitPriceAmount" = CAST(${input.preferredUnitPriceAmount} AS DECIMAL(14,2)),
      "preferredUnitPriceCurrency" = ${input.preferredUnitPriceCurrency},
      "shape" = ${input.shape},
      "capacity" = ${input.capacity},
      "material" = ${input.material},
      "certification" = ${input.certification},
      "feature" = ${input.feature},
      "targetDeliveryDate" = CAST(${input.targetDeliveryDate} AS TIMESTAMP(3)),
      "details" = ${input.details},
      "status" = CAST(${"SUBMITTED"} AS "RfqStatus"),
      "adminStatus" = CAST(${"PENDING_REVIEW"} AS "RfqAdminStatus"),
      "adminNote" = NULL,
      "reviewedByUserId" = NULL,
      "reviewedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "buyerUserId" = ${buyerUserId}
  `;

  const rfq = await getBuyerRfq(buyerUserId, id);
  if (!rfq) throw new Response("RFQ not found.", { status: 404 });
  return rfq;
}

export async function setBuyerRfqLifecycleStatus({
  buyerUserId,
  id,
  status,
}: {
  buyerUserId: string;
  id: string;
  status: Extract<RfqStatus, "CANCELLED" | "CLOSED">;
}) {
  const existing = await getBuyerRfq(buyerUserId, id);
  if (!existing) throw new Response("RFQ not found.", { status: 404 });
  if (status === "CANCELLED" && !canCancelRfq(existing.status)) {
    throw new Response("This RFQ can no longer be cancelled.", { status: 403 });
  }
  if (status === "CLOSED" && existing.status !== "MATCHING_READY" && existing.status !== "APPROVED") {
    throw new Response("Only approved RFQs can be closed.", { status: 403 });
  }

  await getDb().$executeRaw`
    UPDATE "RfqRequest"
    SET "status" = CAST(${status} AS "RfqStatus"), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "buyerUserId" = ${buyerUserId}
  `;
  const rfq = await getBuyerRfq(buyerUserId, id);
  if (!rfq) throw new Response("RFQ not found.", { status: 404 });
  return rfq;
}

export async function listAdminRfqs() {
  const rows = await getDb().$queryRaw<RfqRow[]>`
    SELECT r.*, buyer."displayName" AS "buyerName", buyer."email" AS "buyerEmail",
      company."legalName" AS "buyerCompanyName"
    FROM "RfqRequest" r
    JOIN "UserProfile" buyer ON buyer."id" = r."buyerUserId"
    LEFT JOIN "Company" company ON company."id" = r."buyerCompanyId"
    ORDER BY r."createdAt" DESC
  `;
  return rows.map(serializeRfq);
}

export async function reviewAdminRfq({
  adminUserId,
  id,
  action,
  adminNote,
}: {
  adminUserId: string;
  id: string;
  action: "approve" | "reject" | "note";
  adminNote: string | null;
}) {
  const note = adminNote?.trim() || null;
  const status: RfqStatus | null =
    action === "approve" ? "MATCHING_READY" : action === "reject" ? "REJECTED" : null;
  const adminStatus: RfqAdminStatus | null =
    action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : null;

  if (action === "note") {
    await getDb().$executeRaw`
      UPDATE "RfqRequest"
      SET "adminNote" = ${note}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  } else {
    await getDb().$executeRaw`
      UPDATE "RfqRequest"
      SET "status" = CAST(${status} AS "RfqStatus"),
        "adminStatus" = CAST(${adminStatus} AS "RfqAdminStatus"),
        "adminNote" = ${note},
        "reviewedByUserId" = ${adminUserId},
        "reviewedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  }

  if (action === "approve") {
    const rfq = await getAdminRfq(id);
    if (rfq) await generateSuggestedMatchesForRfq(rfq);
  }

  return getAdminRfqOrThrow(id);
}

async function getAdminRfq(id: string) {
  const rows = await getDb().$queryRaw<RfqRow[]>`
    SELECT r.*, buyer."displayName" AS "buyerName", buyer."email" AS "buyerEmail",
      company."legalName" AS "buyerCompanyName"
    FROM "RfqRequest" r
    JOIN "UserProfile" buyer ON buyer."id" = r."buyerUserId"
    LEFT JOIN "Company" company ON company."id" = r."buyerCompanyId"
    WHERE r."id" = ${id}
    LIMIT 1
  `;
  return rows[0] ? serializeRfq(rows[0]) : null;
}

async function getAdminRfqOrThrow(id: string) {
  const rfq = await getAdminRfq(id);
  if (!rfq) throw new Response("RFQ not found.", { status: 404 });
  return rfq;
}

async function listSuggestedMatches(rfqRequestId: string): Promise<RfqSuggestedMatch[]> {
  const rows = await getDb().$queryRaw<RfqMatchedProductRow[]>`
    SELECT "id", "productId", "rank", "reasons"
    FROM "RfqMatchedProduct"
    WHERE "rfqRequestId" = ${rfqRequestId}
    ORDER BY "rank" ASC
  `;
  if (!rows.length) return [];

  const products = await getDb().product.findMany({
    where: {
      id: { in: rows.map((row) => row.productId) },
      status: "active",
      sellerCompany: {
        verificationStatus: "verified",
        legalName: { not: DELETED_COMPANY_NAME },
      },
    },
    include: {
      images: { orderBy: { position: "asc" } },
      sellerCompany: {
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          logoOriginalUrl: true,
          logoUrl: true,
          logoThumbnailUrl: true,
          useDefaultLogo: true,
          city: true,
          country: true,
          categories: true,
          description: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          sellerProfile: true,
        },
      },
    },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  return rows.flatMap((row) => {
    const product = productById.get(row.productId);
    if (!product) return [];
    return {
      id: row.id,
      productId: row.productId,
      rank: row.rank,
      reasons: row.reasons.flatMap((reason) => normalizeRfqMatchReason(reason) ?? []),
      product: databaseProductToCard(product as unknown as Record<string, unknown>),
    };
  });
}

type MatchCandidate = {
  productId: string;
  score: number;
  updatedAt: Date;
  reasons: RfqMatchReasonCode[];
};

async function generateSuggestedMatchesForRfq(rfq: RfqRecord) {
  await getDb().$executeRaw`
    DELETE FROM "RfqMatchedProduct"
    WHERE "rfqRequestId" = ${rfq.id}
  `;

  const products = await getDb().product.findMany({
    where: {
      status: "active",
      sellerCompany: {
        verificationStatus: "verified",
        legalName: { not: DELETED_COMPANY_NAME },
        ownerUserId: { not: rfq.buyerUserId },
      },
    },
    include: {
      images: { orderBy: { position: "asc" } },
      sellerCompany: {
        select: {
          id: true,
          ownerUserId: true,
          legalName: true,
          tradeName: true,
          country: true,
          city: true,
          categories: true,
          description: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          sellerProfile: {
            select: {
              exportCountries: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 240,
  });

  const rfqTokens = tokenize(`${rfq.productName} ${rfq.details}`);
  const scored = products
    .map((product): MatchCandidate | null => {
      const reasons = new Set<RfqMatchReasonCode>();
      let score = 0;
      const productTokens = tokenize(
        [
          product.name,
          product.category,
          product.tags.join(" "),
          product.shortDescription,
          product.detailedDescription,
          product.ingredientsOrMaterials,
          product.packaging,
          product.certifications.join(" "),
          product.complianceClaims.join(" "),
          product.documentsAvailable.join(" "),
        ].join(" "),
      );
      const productDescriptionTokens = tokenize(
        [
          product.shortDescription,
          product.detailedDescription,
          product.ingredientsOrMaterials,
        ].join(" "),
      );

      if (sameText(product.category, rfq.category)) {
        score += 40;
        reasons.add("same_category");
      }

      const keywordOverlap = overlapCount(rfqTokens, productTokens);
      if (keywordOverlap > 0) {
        score += Math.min(24, keywordOverlap * 4);
        reasons.add("similar_keywords");
      }

      const descriptionOverlap = overlapCount(rfqTokens, productDescriptionTokens);
      if (descriptionOverlap >= 2) {
        score += Math.min(16, descriptionOverlap * 3);
        reasons.add("similar_description");
      }

      const productText = Array.from(productTokens).join(" ");
      if (fieldMatches(rfq.material, productText)) {
        score += 14;
        reasons.add("matching_material");
      }
      if (fieldMatches(rfq.certification, productText)) {
        score += 14;
        reasons.add("matching_certification");
      }
      if (
        fieldMatches(rfq.feature, productText) ||
        fieldMatches(rfq.shape, productText) ||
        fieldMatches(rfq.capacity, productText)
      ) {
        score += 12;
        reasons.add("matching_feature");
      }

      const exportCountries =
        product.sellerCompany.sellerProfile?.exportCountries ?? [];
      if (
        rfq.destinationCountry &&
        exportCountries.some((country) =>
          sameText(country, rfq.destinationCountry ?? ""),
        )
      ) {
        score += 12;
        reasons.add("exports_destination");
      }

      const recentWeight = Math.max(
        0,
        3 - (Date.now() - product.updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30),
      );
      score += recentWeight;

      if (!reasons.size) return null;

      return {
        productId: product.id,
        score,
        updatedAt: product.updatedAt,
        reasons: Array.from(reasons),
      };
    })
    .filter((candidate): candidate is MatchCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 12);

  for (const [index, match] of scored.entries()) {
    await getDb().$executeRaw`
      INSERT INTO "RfqMatchedProduct" (
        "id", "rfqRequestId", "productId", "rank", "reasons"
      ) VALUES (
        ${randomUUID()}, ${rfq.id}, ${match.productId}, ${index + 1},
        ${Prisma.sql`ARRAY[${Prisma.join(match.reasons)}]::TEXT[]`}
      )
      ON CONFLICT ("rfqRequestId", "productId")
      DO UPDATE SET "rank" = EXCLUDED."rank", "reasons" = EXCLUDED."reasons"
    `;
  }
}

function tokenize(value: string | null | undefined) {
  const stopWords = new Set([
    "and",
    "for",
    "the",
    "with",
    "from",
    "this",
    "that",
    "need",
    "want",
    "product",
    "products",
    "please",
    "문의",
    "상품",
    "제품",
    "요청",
    "필요",
  ]);
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !stopWords.has(token)),
  );
}

function overlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return normalizeText(left) === normalizeText(right);
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function fieldMatches(value: string | null | undefined, productText: string) {
  const tokens = tokenize(value);
  if (!tokens.size) return false;
  return Array.from(tokens).some((token) => productText.includes(token));
}
