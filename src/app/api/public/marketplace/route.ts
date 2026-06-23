import { apiError } from "@/lib/api-response";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const [companies, products] = await Promise.all([
      getDb().company.findMany({
        where: { verificationStatus: "verified" },
        include: {
          sellerProfile: true,
          buyerProfile: true,
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
          sellerCompany: { verificationStatus: "verified" },
        },
        include: {
          images: { orderBy: { position: "asc" } },
          sellerCompany: {
            select: {
              id: true,
              legalName: true,
              tradeName: true,
              logoUrl: true,
              logoThumbnailUrl: true,
              useDefaultLogo: true,
              city: true,
              country: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return Response.json({
      companies,
      products: products.map((product) => ({
        ...product,
        priceMin: product.priceMin?.toString() ?? null,
        priceMax: product.priceMax?.toString() ?? null,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
