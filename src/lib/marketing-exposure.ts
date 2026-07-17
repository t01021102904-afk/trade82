import "server-only";

import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import {
  MARKETING_EXPOSURE_PLANS,
  marketingExposurePlanById,
  type MarketingExposurePlanId,
} from "@/lib/marketing-exposure-shared";

type ExposureRow = {
  id: string;
  productId: string;
  plan: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  productName: string;
  productNameEn: string;
  productStatus: string;
  imageUrl: string | null;
};

export function getMarketingExposurePriceId(planId: MarketingExposurePlanId) {
  const plan = marketingExposurePlanById(planId);
  const priceId = plan ? process.env[plan.envName] : "";
  if (!priceId) {
    throw new Error("Marketing exposure Stripe price is not configured.");
  }
  return priceId;
}

export function getMarketingExposurePlanForPriceId(
  priceId: string | null | undefined,
) {
  if (!priceId) return null;
  return (
    MARKETING_EXPOSURE_PLANS.find((plan) => process.env[plan.envName] === priceId) ??
    null
  );
}

export function isProductListedForMarketing(status: string | null | undefined) {
  return status === "active";
}

export async function findSellerOwnedListedProduct({
  companyId,
  productId,
}: {
  companyId: string;
  productId: string;
}) {
  return getDb().product.findFirst({
    where: {
      id: productId,
      sellerCompanyId: companyId,
      status: "active",
      deletedAt: null,
      sellerCompany: {
        companyRole: "seller",
        verificationStatus: "verified",
        legalName: { not: DELETED_COMPANY_NAME },
        deletedAt: null,
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
          verificationStatus: true,
        },
      },
    },
  });
}

export async function listSellerMarketingExposures(companyId: string) {
  const rows = await getDb().$queryRaw<ExposureRow[]>`
    SELECT
      me."id",
      me."productId",
      me."plan"::text AS "plan",
      me."status"::text AS "status",
      me."startsAt",
      me."endsAt",
      me."createdAt",
      p."name" AS "productName",
      p."nameEn" AS "productNameEn",
      p."status"::text AS "productStatus",
      COALESCE(pi."cardUrl", pi."mainUrl", pi."detailUrl", p."imageUrl") AS "imageUrl"
    FROM "MarketingExposure" me
    JOIN "Product" p ON p."id" = me."productId"
    LEFT JOIN LATERAL (
      SELECT "cardUrl", "mainUrl", "detailUrl"
      FROM "ProductImage"
      WHERE "productId" = p."id"
      ORDER BY "position" ASC
      LIMIT 1
    ) pi ON TRUE
    WHERE me."companyId" = ${companyId}
    ORDER BY me."createdAt" DESC
    LIMIT 24
  `;

  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function activateMarketingExposure({
  checkoutSessionId,
  customerId,
  paymentIntentId,
  productId,
  companyId,
  userId,
  planId,
  priceId,
  amount,
  currency,
}: {
  checkoutSessionId: string;
  customerId: string | null;
  paymentIntentId: string | null;
  productId: string;
  companyId: string;
  userId: string;
  planId: MarketingExposurePlanId;
  priceId: string;
  amount: number;
  currency: string;
}) {
  const plan = marketingExposurePlanById(planId);
  if (!plan) {
    throw new Error("Marketing exposure plan is invalid.");
  }

  const product = await getDb().product.findFirst({
    where: {
      id: productId,
      sellerCompanyId: companyId,
      status: "active",
      deletedAt: null,
      sellerCompany: {
        companyRole: "seller",
        legalName: { not: DELETED_COMPANY_NAME },
        deletedAt: null,
      },
    },
    select: {
      id: true,
      sellerCompanyId: true,
      sellerCompany: {
        select: { ownerUserId: true },
      },
    },
  });

  if (!product) {
    console.warn("Marketing exposure webhook rejected an ineligible product.", {
      productId,
      companyId,
    });
    return null;
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60_000);
  const exposureId = crypto.randomUUID();
  const ownerUserId = userId || product.sellerCompany.ownerUserId;

  await getDb().$executeRaw`
    INSERT INTO "MarketingExposure" (
      "id",
      "companyId",
      "productId",
      "userId",
      "plan",
      "status",
      "stripeCustomerId",
      "stripeCheckoutSessionId",
      "stripePaymentIntentId",
      "priceId",
      "amount",
      "currency",
      "startsAt",
      "endsAt",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${exposureId},
      ${companyId},
      ${productId},
      ${ownerUserId},
      ${plan.dbPlan}::"MarketingExposurePlan",
      'ACTIVE'::"MarketingExposureStatus",
      ${customerId},
      ${checkoutSessionId},
      ${paymentIntentId},
      ${priceId},
      ${amount},
      ${currency.toLowerCase()},
      ${startsAt},
      ${endsAt},
      ${startsAt},
      ${startsAt}
    )
    ON CONFLICT ("stripeCheckoutSessionId") DO UPDATE SET
      "companyId" = EXCLUDED."companyId",
      "productId" = EXCLUDED."productId",
      "userId" = EXCLUDED."userId",
      "plan" = EXCLUDED."plan",
      "status" = EXCLUDED."status",
      "stripeCustomerId" = EXCLUDED."stripeCustomerId",
      "stripePaymentIntentId" = EXCLUDED."stripePaymentIntentId",
      "priceId" = EXCLUDED."priceId",
      "amount" = EXCLUDED."amount",
      "currency" = EXCLUDED."currency",
      "startsAt" = EXCLUDED."startsAt",
      "endsAt" = EXCLUDED."endsAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;

  return { productId, companyId, startsAt, endsAt };
}

export async function listActiveMarketingProductIds(limit = 100) {
  const now = new Date();
  const rows = await getDb().$queryRaw<Array<{ productId: string }>>`
    SELECT DISTINCT ON (me."productId")
      me."productId"
    FROM "MarketingExposure" me
    JOIN "Product" p ON p."id" = me."productId"
    JOIN "Company" c ON c."id" = me."companyId"
    WHERE me."status" = 'ACTIVE'::"MarketingExposureStatus"
      AND me."startsAt" <= ${now}
      AND me."endsAt" > ${now}
      AND p."status" = 'active'::"ProductStatus"
      AND p."deletedAt" IS NULL
      AND p."sellerCompanyId" = me."companyId"
      AND c."companyRole" = 'seller'::"CompanyRole"
      AND c."verificationStatus" = 'verified'::"CompanyVerificationStatus"
      AND c."deletedAt" IS NULL
      AND c."legalName" <> ${DELETED_COMPANY_NAME}
    ORDER BY me."productId", me."endsAt" DESC
  `;

  const dateSeed = now.toISOString().slice(0, 10);
  return rows
    .map((row) => row.productId)
    .sort((left, right) => {
      const leftHash = dailyHash(`${left}:${dateSeed}`);
      const rightHash = dailyHash(`${right}:${dateSeed}`);
      return leftHash - rightHash;
    })
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

function dailyHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
