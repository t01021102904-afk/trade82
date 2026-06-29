import { apiError } from "@/lib/api-response";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { isTrade82TeamAccount } from "@/lib/trade82-team";

export async function GET() {
  try {
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
              logoOriginalUrl: true,
              logoUrl: true,
              logoThumbnailUrl: true,
              useDefaultLogo: true,
              city: true,
              country: true,
              categories: true,
              description: true,
              sellerProfile: true,
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
      products: products.map((product) => {
        const { owner, ...sellerCompany } = product.sellerCompany;
        return {
          ...product,
          sellerCompany: {
            ...sellerCompany,
            isTrade82Team: isTrade82TeamAccount(owner),
          },
          priceMin: product.priceMin?.toString() ?? null,
          priceMax: product.priceMax?.toString() ?? null,
        };
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
