import { apiError } from "@/lib/api-response";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { cleanPlainText } from "@/lib/marketplace";
import { maskProductFieldsForViewer } from "@/lib/product-field-visibility";
import { isTrade82TeamAccount } from "@/lib/trade82-team";
import { Prisma } from "@/generated/prisma/client";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    const profile = await getCurrentUserProfile().catch(() => null);
    const admin = profile ? await isAdminUser().catch(() => false) : false;

    if (resource === "products") {
      return Response.json(
        await getPaginatedProducts({
          searchParams: url.searchParams,
          profileId: profile?.id ?? null,
          admin,
        }),
      );
    }

    if (resource === "companies") {
      return Response.json(
        await getPaginatedCompanies({ searchParams: url.searchParams }),
      );
    }

    const [companies, products] = await Promise.all([
      getDb().company.findMany({
        where: {
          verificationStatus: "verified",
          legalName: { not: DELETED_COMPANY_NAME },
        },
        include: {
          owner: {
            select: {
              displayName: true,
              email: true,
              jobTitle: true,
              role: true,
            },
          },
          sellerProfile: true,
          buyerProfile: true,
          _count: {
            select: { products: true },
          },
          reviewsReceived: {
            where: { isPublic: true, adminApproved: true },
            include: {
              reviewerCompany: {
                select: { legalName: true, tradeName: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      getDb().product.findMany({
        where: {
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
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const publicCompanies = companies.map((company) => {
      const { owner, ...publicCompany } = company;
      return {
        ...publicCompany,
        owner: {
          displayName: owner.displayName,
          jobTitle: owner.jobTitle,
        },
        isTrade82Team: isTrade82TeamAccount(owner),
      };
    });

    return Response.json({
      companies: publicCompanies,
      products: serializeProducts(products, profile?.id ?? null, admin),
    });
  } catch (error) {
    return apiError(error);
  }
}

async function getPaginatedProducts({
  searchParams,
  profileId,
  admin,
}: {
  searchParams: URLSearchParams;
  profileId: string | null;
  admin: boolean;
}) {
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
        include: publicProductInclude(),
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderedProducts = productIds
    .map((id) => productById.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return {
    products: serializeProducts(orderedProducts, profileId, admin),
    pagination: paginationPayload(page, pageSize, total),
    filterOptions: await getProductFilterOptions(),
  };
}

async function getPaginatedCompanies({
  searchParams,
}: {
  searchParams: URLSearchParams;
}) {
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const requestedPage = parsePage(searchParams.get("page"));
  const companyQuery = buildCompanyQuery(searchParams);
  const db = getDb();
  const countRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    ${companyQuery.from}
    ${companyQuery.where}
  `;
  const total = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;
  const idRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT c."id"
    ${companyQuery.from}
    ${companyQuery.where}
    ORDER BY c."updatedAt" DESC, c."id" ASC
    OFFSET ${skip}
    LIMIT ${pageSize}
  `;
  const companyIds = idRows.map((row) => row.id);
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        include: publicCompanyInclude(),
      })
    : [];
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const orderedCompanies = companyIds
    .map((id) => companyById.get(id))
    .filter((company): company is NonNullable<typeof company> => Boolean(company));

  return {
    companies: serializeCompanies(orderedCompanies),
    pagination: paginationPayload(page, pageSize, total),
    filterOptions: await getCompanyFilterOptions(),
  };
}

function publicCompanyInclude() {
  return {
    owner: {
      select: {
        displayName: true,
        email: true,
        jobTitle: true,
        role: true,
      },
    },
    sellerProfile: true,
    buyerProfile: true,
    _count: {
      select: { products: true },
    },
    reviewsReceived: {
      where: { isPublic: true, adminApproved: true },
      include: {
        reviewerCompany: {
          select: { legalName: true, tradeName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    },
  } satisfies Prisma.CompanyInclude;
}

function publicProductInclude() {
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

function serializeCompanies(
  companies: Awaited<ReturnType<typeof getDb>>["company"] extends never
    ? never[]
    : Array<Prisma.CompanyGetPayload<{ include: ReturnType<typeof publicCompanyInclude> }>>,
) {
  return companies.map((company) => {
    const { owner, ...publicCompany } = company;
    return {
      ...publicCompany,
      owner: {
        displayName: owner.displayName,
        jobTitle: owner.jobTitle,
      },
      isTrade82Team: isTrade82TeamAccount(owner),
    };
  });
}

function serializeProducts(
  products: Array<Prisma.ProductGetPayload<{ include: ReturnType<typeof publicProductInclude> }>>,
  profileId: string | null,
  admin: boolean,
) {
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
    };
  });
}

function buildProductQuery(searchParams: URLSearchParams) {
  const query = cleanQuery(searchParams.get("q"));
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

function buildCompanyQuery(searchParams: URLSearchParams) {
  const query = cleanQuery(searchParams.get("q"));
  const category = cleanQuery(searchParams.get("category"));
  const state = cleanQuery(searchParams.get("state"));
  const verified = cleanQuery(searchParams.get("verified"));
  const exportExperience = cleanQuery(searchParams.get("exportExperience"));
  const conditions: Prisma.Sql[] = [
    Prisma.sql`c."companyRole" = 'seller'::"CompanyRole"`,
    Prisma.sql`c."verificationStatus" = 'verified'::"CompanyVerificationStatus"`,
    Prisma.sql`c."legalName" <> ${DELETED_COMPANY_NAME}`,
  ];

  if (query) {
    const search = `%${query}%`;
    conditions.push(Prisma.sql`(
      c."legalName" ILIKE ${search}
      OR COALESCE(c."tradeName", '') ILIKE ${search}
      OR c."displayNameEn" ILIKE ${search}
      OR c."country" ILIKE ${search}
      OR c."city" ILIKE ${search}
      OR c."description" ILIKE ${search}
      OR c."descriptionEn" ILIKE ${search}
      OR COALESCE(sp."representativeName", '') ILIKE ${search}
      OR COALESCE(sp."factoryOrDistributorStatus", '') ILIKE ${search}
    )`);
  }
  if (category && category !== "all") {
    conditions.push(Prisma.sql`${category} = ANY(c."categories")`);
  }
  if (state && state !== "all") {
    conditions.push(Prisma.sql`(
      c."stateOrProvince" = ${state}
      OR (c."stateOrProvince" = '' AND c."city" = ${state})
    )`);
  }
  if (verified === "reviewing") {
    conditions.push(Prisma.sql`FALSE`);
  }
  if (exportExperience === "korea") {
    conditions.push(Prisma.sql`cardinality(COALESCE(sp."exportCountries", ARRAY[]::text[])) > 0`);
  } else if (exportExperience === "multi") {
    conditions.push(Prisma.sql`cardinality(COALESCE(sp."exportCountries", ARRAY[]::text[])) >= 3`);
  } else if (exportExperience === "fast") {
    conditions.push(Prisma.sql`FALSE`);
  }

  return {
    from: Prisma.sql`FROM "Company" c LEFT JOIN "SellerProfile" sp ON sp."companyId" = c."id"`,
    where: Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`,
  };
}

async function getProductFilterOptions() {
  const [certificationRows, shippingRows] = await Promise.all([
    getDb().$queryRaw<Array<{ value: string }>>`
      SELECT DISTINCT value
      FROM "Product" p, unnest(p."certifications") value
      JOIN "Company" c ON c."id" = p."sellerCompanyId"
      WHERE p."status" = 'active'::"ProductStatus"
        AND c."verificationStatus" = 'verified'::"CompanyVerificationStatus"
        AND c."legalName" <> ${DELETED_COMPANY_NAME}
        AND value <> ''
      ORDER BY value ASC
    `,
    getDb().$queryRaw<Array<{ value: string }>>`
      SELECT DISTINCT value
      FROM "Product" p, unnest(p."incoterms") value
      JOIN "Company" c ON c."id" = p."sellerCompanyId"
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

async function getCompanyFilterOptions() {
  const rows = await getDb().$queryRaw<Array<{ value: string }>>`
    SELECT DISTINCT COALESCE(NULLIF(c."stateOrProvince", ''), c."city") AS value
    FROM "Company" c
    WHERE c."companyRole" = 'seller'::"CompanyRole"
      AND c."verificationStatus" = 'verified'::"CompanyVerificationStatus"
      AND c."legalName" <> ${DELETED_COMPANY_NAME}
      AND COALESCE(NULLIF(c."stateOrProvince", ''), c."city") <> ''
    ORDER BY value ASC
  `;
  return { states: rows.map((row) => row.value) };
}

function cleanQuery(value: string | null) {
  const cleaned = cleanPlainText(value ?? "", 120);
  return cleaned || "all";
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parsePageSize(value: string | null) {
  const pageSize = Number(value);
  return Number.isFinite(pageSize) && pageSize > 0
    ? Math.min(MAX_PAGE_SIZE, Math.floor(pageSize))
    : DEFAULT_PAGE_SIZE;
}

function paginationPayload(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
