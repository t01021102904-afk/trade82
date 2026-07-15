import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { cleanPlainText } from "@/lib/marketplace";
import { maskProductFieldsForViewer } from "@/lib/product-field-visibility";
import { isTrade82TeamAccount } from "@/lib/trade82-team";
import {
  marketplacePagination,
  PUBLIC_MARKETPLACE_PAGE_SIZE,
  type MarketplacePagination,
  type MarketplaceProductFilterOptions,
} from "@/lib/public-marketplace-query-state";

const MAX_PAGE_SIZE = 100;

export type PublicMarketplaceProduct = Record<string, unknown>;

export type PublicMarketplaceProductsResult = {
  products: PublicMarketplaceProduct[];
  pagination: MarketplacePagination;
  filterOptions: MarketplaceProductFilterOptions;
};

export async function getPublicMarketplaceProducts({
  searchParams,
  profileId,
  admin,
}: {
  searchParams: URLSearchParams;
  profileId: string | null;
  admin: boolean;
}): Promise<PublicMarketplaceProductsResult> {
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const requestedPage = parsePage(searchParams.get("page"));
  const productQuery = buildProductQuery(searchParams);
  const db = getDb();
  const countRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    ${productQuery.from}
    ${productQuery.where}
  `;
  const total = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;
  const idRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p."id"
    ${productQuery.from}
    ${productQuery.where}
    ORDER BY p."updatedAt" DESC, p."id" ASC
    OFFSET ${skip}
    LIMIT ${pageSize}
  `;
  const productIds = idRows.map((row) => row.id);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        include: publicMarketplaceProductInclude(),
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderedProducts = productIds
    .map((id) => productById.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return {
    products: serializePublicMarketplaceProducts(orderedProducts, profileId, admin),
    pagination: marketplacePagination(page, pageSize, total),
    filterOptions: await getPublicMarketplaceProductFilterOptions(),
  };
}

export function publicMarketplaceProductInclude() {
  return {
    images: { orderBy: { position: "asc" } },
    sellerCompany: {
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        displayNameEn: true,
        logoOriginalUrl: true,
        logoUrl: true,
        logoThumbnailUrl: true,
        useDefaultLogo: true,
        city: true,
        country: true,
        categories: true,
        description: true,
        descriptionEn: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        sellerProfile: true,
        ownerUserId: true,
        owner: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    },
  } satisfies Prisma.ProductInclude;
}

export function serializePublicMarketplaceProducts(
  products: Array<
    Prisma.ProductGetPayload<{
      include: ReturnType<typeof publicMarketplaceProductInclude>;
    }>
  >,
  profileId: string | null,
  admin: boolean,
): PublicMarketplaceProduct[] {
  return products.map((product) => {
    const canViewSensitiveFields =
      admin || Boolean(profileId && product.sellerCompany.ownerUserId === profileId);
    const visibleProduct = maskProductFieldsForViewer(
      product,
      canViewSensitiveFields,
    );
    const { owner, ownerUserId, ...sellerCompany } = visibleProduct.sellerCompany;
    void ownerUserId;
    return {
      ...visibleProduct,
      sellerCompany: {
        ...sellerCompany,
        isTrade82Team: isTrade82TeamAccount(owner),
      },
      priceMin: visibleProduct.priceMin?.toString() ?? null,
      priceMax: visibleProduct.priceMax?.toString() ?? null,
    } as PublicMarketplaceProduct;
  });
}

function buildProductQuery(searchParams: URLSearchParams) {
  const query = cleanSearch(searchParams.get("q"));
  const category = cleanQuery(searchParams.get("category"));
  const price = cleanQuery(searchParams.get("price"));
  const moq = cleanQuery(searchParams.get("moq"));
  const certification = cleanQuery(searchParams.get("certification"));
  const shipping = cleanQuery(searchParams.get("shipping"));
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."status" = 'active'::"ProductStatus"`,
    Prisma.sql`c."verificationStatus" = 'verified'::"CompanyVerificationStatus"`,
    Prisma.sql`c."legalName" <> ${DELETED_COMPANY_NAME}`,
  ];

  if (query) {
    const search = `%${query}%`;
    conditions.push(Prisma.sql`(
      p."name" ILIKE ${search}
      OR p."nameEn" ILIKE ${search}
      OR p."category" ILIKE ${search}
      OR p."shortDescription" ILIKE ${search}
      OR p."shortDescriptionEn" ILIKE ${search}
      OR p."detailedDescription" ILIKE ${search}
      OR p."detailedDescriptionEn" ILIKE ${search}
      OR c."legalName" ILIKE ${search}
      OR COALESCE(c."tradeName", '') ILIKE ${search}
      OR c."displayNameEn" ILIKE ${search}
    )`);
  }
  if (category && category !== "all") {
    conditions.push(Prisma.sql`p."category" = ${category}`);
  }
  if (price === "under-3") {
    conditions.push(Prisma.sql`p."priceMin" IS NOT NULL AND p."priceMin" < 3`);
  } else if (price === "3-8") {
    conditions.push(Prisma.sql`p."priceMin" IS NOT NULL AND p."priceMin" >= 3 AND p."priceMin" <= 8`);
  } else if (price === "8-plus") {
    conditions.push(Prisma.sql`p."priceMin" IS NOT NULL AND p."priceMin" > 8`);
  }
  if (moq !== "all" && Number.isFinite(Number(moq))) {
    conditions.push(Prisma.sql`
      COALESCE(
        NULLIF(regexp_replace(COALESCE(NULLIF(p."moqQuantity", ''), p."moq", ''), '[^0-9.]', '', 'g'), '')::numeric,
        999999999
      ) <= ${Number(moq)}
    `);
  }
  if (certification && certification !== "all") {
    conditions.push(Prisma.sql`${certification} = ANY(p."certifications")`);
  }
  if (shipping && shipping !== "all") {
    conditions.push(Prisma.sql`${shipping} = ANY(p."incoterms")`);
  }

  return {
    from: Prisma.sql`FROM "Product" p JOIN "Company" c ON c."id" = p."sellerCompanyId"`,
    where: Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`,
  };
}

async function getPublicMarketplaceProductFilterOptions(): Promise<MarketplaceProductFilterOptions> {
  const [certificationRows, shippingRows] = await Promise.all([
    getDb().$queryRaw<Array<{ value: string }>>`
      SELECT DISTINCT value
      FROM "Product" p
      JOIN "Company" c ON c."id" = p."sellerCompanyId"
      CROSS JOIN LATERAL unnest(p."certifications") AS value
      WHERE p."status" = 'active'::"ProductStatus"
        AND c."verificationStatus" = 'verified'::"CompanyVerificationStatus"
        AND c."legalName" <> ${DELETED_COMPANY_NAME}
        AND value <> ''
      ORDER BY value ASC
    `,
    getDb().$queryRaw<Array<{ value: string }>>`
      SELECT DISTINCT value
      FROM "Product" p
      JOIN "Company" c ON c."id" = p."sellerCompanyId"
      CROSS JOIN LATERAL unnest(p."incoterms") AS value
      WHERE p."status" = 'active'::"ProductStatus"
        AND c."verificationStatus" = 'verified'::"CompanyVerificationStatus"
        AND c."legalName" <> ${DELETED_COMPANY_NAME}
        AND value <> ''
      ORDER BY value ASC
    `,
  ]);
  return {
    certifications: certificationRows.map((row) => row.value),
    shippingTerms: shippingRows.map((row) => row.value),
  };
}

function cleanQuery(value: string | null) {
  const cleaned = cleanPlainText(value ?? "", 120);
  return cleaned || "all";
}

function cleanSearch(value: string | null) {
  return cleanPlainText(value ?? "", 120);
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parsePageSize(value: string | null) {
  const pageSize = Number(value);
  return Number.isFinite(pageSize) && pageSize > 0
    ? Math.min(MAX_PAGE_SIZE, Math.floor(pageSize))
    : PUBLIC_MARKETPLACE_PAGE_SIZE;
}
