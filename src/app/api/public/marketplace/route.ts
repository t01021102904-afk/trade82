import { apiError } from "@/lib/api-response";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { cleanPlainText } from "@/lib/marketplace";
import { isTrade82TeamAccount } from "@/lib/trade82-team";
import {
  getPublicMarketplaceProducts,
  publicMarketplaceProductInclude,
  serializePublicMarketplaceProducts,
} from "@/lib/public-marketplace-data";
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
        await getPublicMarketplaceProducts({
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
          deletedAt: null,
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
          deletedAt: null,
          sellerCompany: {
            verificationStatus: "verified",
            deletedAt: null,
            legalName: { not: DELETED_COMPANY_NAME },
          },
        },
        include: publicMarketplaceProductInclude(),
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
      products: serializePublicMarketplaceProducts(
        products,
        profile?.id ?? null,
        admin,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
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

function serializeCompanies(
  companies: Array<
    Prisma.CompanyGetPayload<{ include: ReturnType<typeof publicCompanyInclude> }>
  >,
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

function buildCompanyQuery(searchParams: URLSearchParams) {
  const query = cleanSearch(searchParams.get("q"));
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
