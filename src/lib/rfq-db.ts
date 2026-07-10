import "server-only";

import { randomUUID } from "crypto";

import { Prisma } from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { sha256Hex } from "@/lib/message-attachments";
import { sendNewMessageNotification } from "@/lib/message-email-notifications";
import { databaseProductToCard } from "@/lib/public-marketplace-presenters";
import {
  canCancelRfq,
  canEditRfq,
  normalizeRfqMatchReason,
  normalizeRfqSellerQuoteStatus,
  type RfqMatchReasonCode,
  type RfqAdminStatus,
  type RfqFormValue,
  type RfqRecord,
  type RfqSellerQuote,
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

type RfqSellerQuoteRow = {
  id: string;
  rfqRequestId: string;
  sellerCompanyId: string;
  sellerLegalName: string;
  sellerTradeName: string | null;
  sellerLogoOriginalUrl: string | null;
  sellerLogoUrl: string | null;
  sellerLogoThumbnailUrl: string | null;
  sellerUseDefaultLogo: boolean;
  productId: string | null;
  conversationId: string | null;
  status: string;
  unitPriceAmount: string | null;
  unitPriceCurrency: string | null;
  moq: string | null;
  leadTime: string | null;
  incoterms: string | null;
  sampleAvailable: boolean | null;
  privateLabelAvailable: boolean | null;
  notes: string | null;
  submittedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
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
    sellerQuotes: await listSellerQuotes(row.id),
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

function isSerializableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
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

async function listSellerQuotes(rfqRequestId: string): Promise<RfqSellerQuote[]> {
  const rows = await getDb().$queryRaw<RfqSellerQuoteRow[]>`
    SELECT q."id", q."rfqRequestId", q."sellerCompanyId",
      seller."legalName" AS "sellerLegalName",
      seller."tradeName" AS "sellerTradeName",
      seller."logoOriginalUrl" AS "sellerLogoOriginalUrl",
      seller."logoUrl" AS "sellerLogoUrl",
      seller."logoThumbnailUrl" AS "sellerLogoThumbnailUrl",
      seller."useDefaultLogo" AS "sellerUseDefaultLogo",
      q."productId", q."conversationId", q."status"::TEXT AS "status",
      q."unitPriceAmount"::TEXT AS "unitPriceAmount",
      q."unitPriceCurrency", q."moq", q."leadTime", q."incoterms",
      q."sampleAvailable", q."privateLabelAvailable", q."notes",
      q."submittedAt", q."createdAt", q."updatedAt"
    FROM "RfqSellerQuote" q
    JOIN "Company" seller ON seller."id" = q."sellerCompanyId"
    WHERE q."rfqRequestId" = ${rfqRequestId}
    ORDER BY q."createdAt" ASC
  `;
  if (!rows.length) return [];

  const productIds = rows.flatMap((row) => row.productId ?? []);
  const products = productIds.length
    ? await getDb().product.findMany({
        where: {
          id: { in: productIds },
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
      })
    : [];
  const productById = new Map(
    products.map((product) => [
      product.id,
      databaseProductToCard(product as unknown as Record<string, unknown>),
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    rfqRequestId: row.rfqRequestId,
    sellerCompanyId: row.sellerCompanyId,
    sellerName: row.sellerTradeName || row.sellerLegalName,
    sellerLogoUrl:
      row.sellerLogoThumbnailUrl ?? row.sellerLogoUrl ?? row.sellerLogoOriginalUrl ?? undefined,
    sellerUseDefaultLogo: row.sellerUseDefaultLogo,
    productId: row.productId,
    product: row.productId ? productById.get(row.productId) ?? null : null,
    conversationId: row.conversationId,
    status: normalizeRfqSellerQuoteStatus(row.status),
    unitPriceAmount: row.unitPriceAmount,
    unitPriceCurrency: row.unitPriceCurrency,
    moq: row.moq,
    leadTime: row.leadTime,
    incoterms: row.incoterms,
    sampleAvailable: row.sampleAvailable,
    privateLabelAvailable: row.privateLabelAvailable,
    notes: row.notes,
    submittedAt: toIso(row.submittedAt),
    createdAt: toIso(row.createdAt) ?? "",
    updatedAt: toIso(row.updatedAt) ?? "",
  }));
}

type SelectableRfqMatchRow = {
  productId: string;
  sellerCompanyId: string;
};

export async function createOrReuseRfqSellerQuote({
  buyerUserId,
  rfqId,
  productId,
  sellerCompanyId,
}: {
  buyerUserId: string;
  rfqId: string;
  productId: string;
  sellerCompanyId: string;
}) {
  const rfq = await getBuyerRfq(buyerUserId, rfqId);
  if (!rfq) throw new Response("RFQ not found.", { status: 404 });
  if (rfq.status !== "MATCHING_READY" && rfq.status !== "APPROVED") {
    throw new Response("Only approved RFQs can add selected sellers.", {
      status: 403,
    });
  }

  const matches = await getDb().$queryRaw<SelectableRfqMatchRow[]>`
    SELECT p."id" AS "productId", p."sellerCompanyId" AS "sellerCompanyId"
    FROM "RfqMatchedProduct" m
    JOIN "Product" p ON p."id" = m."productId"
    JOIN "Company" seller ON seller."id" = p."sellerCompanyId"
    WHERE m."rfqRequestId" = ${rfqId}
      AND m."productId" = ${productId}
      AND p."sellerCompanyId" = ${sellerCompanyId}
      AND p."status" = CAST(${"active"} AS "ProductStatus")
      AND seller."companyRole" = CAST(${"seller"} AS "CompanyRole")
      AND seller."verificationStatus" = CAST(${"verified"} AS "CompanyVerificationStatus")
      AND seller."legalName" <> ${DELETED_COMPANY_NAME}
      AND seller."ownerUserId" <> ${buyerUserId}
    LIMIT 1
  `;

  if (!matches[0]) {
    throw new Response("This seller is not available for this RFQ match.", {
      status: 404,
    });
  }

  await getDb().$executeRaw`
    INSERT INTO "RfqSellerQuote" (
      "id", "rfqRequestId", "sellerCompanyId", "productId", "status", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${rfqId}, ${sellerCompanyId}, ${productId},
      CAST(${"REQUESTED"} AS "RfqSellerQuoteStatus"), CURRENT_TIMESTAMP
    )
    ON CONFLICT ("rfqRequestId", "sellerCompanyId")
    DO UPDATE SET
      "productId" = COALESCE("RfqSellerQuote"."productId", EXCLUDED."productId"),
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  const updated = await getBuyerRfq(buyerUserId, rfqId);
  if (!updated) throw new Response("RFQ not found.", { status: 404 });
  return updated;
}

export async function createOrReuseRfqQuoteConversation({
  buyerUserId,
  rfqId,
  quoteId,
  locale,
}: {
  buyerUserId: string;
  rfqId: string;
  quoteId: string;
  locale: "en" | "ko";
}) {
  const rfq = await getBuyerRfq(buyerUserId, rfqId);
  if (!rfq) throw new Response("RFQ not found.", { status: 404 });
  if (!rfq.buyerCompanyId) {
    throw new Response("Complete your buyer profile before contacting sellers.", {
      status: 409,
    });
  }

  const quote = rfq.sellerQuotes?.find((item) => item.id === quoteId);
  if (!quote) throw new Response("Selected seller quote not found.", { status: 404 });

  const buyerCompany = await getDb().company.findFirst({
    where: {
      id: rfq.buyerCompanyId,
      ownerUserId: buyerUserId,
      companyRole: "buyer",
    },
  });
  if (!buyerCompany) {
    throw new Response("Complete your buyer profile before contacting sellers.", {
      status: 409,
    });
  }

  const sellerCompany = await getDb().company.findFirst({
    where: {
      id: quote.sellerCompanyId,
      companyRole: "seller",
      verificationStatus: "verified",
      legalName: { not: DELETED_COMPANY_NAME },
    },
  });
  if (!sellerCompany) {
    throw new Response("Selected seller is not available.", { status: 404 });
  }

  const product = quote.productId
    ? await getDb().product.findFirst({
        where: {
          id: quote.productId,
          sellerCompanyId: sellerCompany.id,
          status: "active",
        },
        select: { id: true, name: true },
      })
    : null;
  const introBody = buildRfqIntroMessage(rfq, locale);
  const contentHash = sha256Hex(introBody);

  const existingStoredConversation = quote.conversationId
    ? await getDb().inquiry.findFirst({
        where: {
          id: quote.conversationId,
          buyerCompanyId: buyerCompany.id,
          sellerCompanyId: sellerCompany.id,
        },
        select: { id: true },
      })
    : null;

  if (existingStoredConversation) {
    return {
      rfq,
      messageRoute: `/messages?inquiryId=${existingStoredConversation.id}`,
    };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await getDb().$transaction(
        async (tx) => {
          const existingInquiry = await tx.inquiry.findFirst({
            where: {
              buyerCompanyId: buyerCompany.id,
              sellerCompanyId: sellerCompany.id,
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true, productId: true },
          });

          if (existingInquiry) {
            const existingIntro = await tx.message.findFirst({
              where: {
                inquiryId: existingInquiry.id,
                senderUserId: buyerUserId,
                senderCompanyId: buyerCompany.id,
                receiverCompanyId: sellerCompany.id,
                contentHash,
              },
              select: { id: true },
            });

            const message = existingIntro
              ? null
              : await tx.message.create({
                  data: {
                    inquiryId: existingInquiry.id,
                    senderUserId: buyerUserId,
                    senderCompanyId: buyerCompany.id,
                    receiverCompanyId: sellerCompany.id,
                    body: introBody,
                    contentHash,
                  },
                });

            const updateData: Prisma.InquiryUpdateInput = {};
            if (product && existingInquiry.productId !== product.id) {
              updateData.product = { connect: { id: product.id } };
            }
            if (message) updateData.updatedAt = new Date();
            if (Object.keys(updateData).length) {
              await tx.inquiry.update({
                where: { id: existingInquiry.id },
                data: updateData,
              });
            }

            await tx.$executeRaw`
              UPDATE "RfqSellerQuote"
              SET "conversationId" = ${existingInquiry.id}, "updatedAt" = CURRENT_TIMESTAMP
              WHERE "id" = ${quoteId}
                AND "rfqRequestId" = ${rfqId}
                AND "sellerCompanyId" = ${sellerCompany.id}
            `;

            return {
              inquiryId: existingInquiry.id,
              notification: message
                ? {
                    messageId: message.id,
                    receiverCompanyId: sellerCompany.id,
                    body: introBody,
                  }
                : null,
            };
          }

          const inquiry = await tx.inquiry.create({
            data: {
              buyerCompanyId: buyerCompany.id,
              sellerCompanyId: sellerCompany.id,
              productId: product?.id ?? null,
              senderUserId: buyerUserId,
              recipientCompanyId: sellerCompany.id,
              message: introBody,
              quantity: rfq.quantity,
              targetDate: rfq.targetDeliveryDate
                ? new Date(rfq.targetDeliveryDate)
                : null,
            },
            select: { id: true, recipientCompanyId: true, message: true },
          });

          await tx.$executeRaw`
            UPDATE "RfqSellerQuote"
            SET "conversationId" = ${inquiry.id}, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${quoteId}
              AND "rfqRequestId" = ${rfqId}
              AND "sellerCompanyId" = ${sellerCompany.id}
          `;

          return {
            inquiryId: inquiry.id,
            notification: {
              messageId: `inquiry-${inquiry.id}`,
              receiverCompanyId: inquiry.recipientCompanyId,
              body: inquiry.message,
            },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (result.notification) {
        await sendNewMessageNotification({
          messageId: result.notification.messageId,
          inquiryId: result.inquiryId,
          senderUserId: buyerUserId,
          senderCompanyName: buyerCompany.tradeName || buyerCompany.legalName,
          receiverCompanyId: result.notification.receiverCompanyId,
          body: result.notification.body,
          attachmentCount: 0,
        }).catch((error) => {
          console.error("RFQ message notification email failed.", {
            name: error instanceof Error ? error.name : typeof error,
          });
        });
      }

      const updated = await getBuyerRfq(buyerUserId, rfqId);
      if (!updated) throw new Response("RFQ not found.", { status: 404 });
      return {
        rfq: updated,
        messageRoute: `/messages?inquiryId=${result.inquiryId}`,
      };
    } catch (error) {
      if (!isSerializableTransactionError(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}

function buildRfqIntroMessage(rfq: RfqRecord, locale: "en" | "ko") {
  const empty = locale === "ko" ? "미입력" : "Not provided";
  const amount = rfq.preferredUnitPriceAmount
    ? `${rfq.preferredUnitPriceAmount} ${rfq.preferredUnitPriceCurrency ?? ""}`.trim()
    : empty;
  if (locale === "ko") {
    return [
      "새 RFQ 견적 요청",
      "",
      `상품명: ${rfq.productName}`,
      `카테고리: ${rfq.category}`,
      `수량: ${rfq.quantity}`,
      `거래 조건: ${rfq.tradeTerms}`,
      `희망 단가: ${amount}`,
      `납품 국가: ${rfq.destinationCountry || empty}`,
      "",
      "스펙:",
      `형태: ${rfq.shape || empty}`,
      `용량: ${rfq.capacity || empty}`,
      `소재: ${rfq.material || empty}`,
      `인증: ${rfq.certification || empty}`,
      `특징: ${rfq.feature || empty}`,
      "",
      "상세 요청사항:",
      rfq.details,
    ].join("\n");
  }
  return [
    "New RFQ request",
    "",
    `Product: ${rfq.productName}`,
    `Category: ${rfq.category}`,
    `Quantity: ${rfq.quantity}`,
    `Trade terms: ${rfq.tradeTerms}`,
    `Preferred unit price: ${amount}`,
    `Destination country: ${rfq.destinationCountry || empty}`,
    "",
    "Specifications:",
    `Shape: ${rfq.shape || empty}`,
    `Capacity: ${rfq.capacity || empty}`,
    `Material: ${rfq.material || empty}`,
    `Certification: ${rfq.certification || empty}`,
    `Feature: ${rfq.feature || empty}`,
    "",
    "Details:",
    rfq.details,
  ].join("\n");
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
