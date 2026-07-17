import { apiError } from "@/lib/api-response";
import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import { listActiveMarketingProductIds } from "@/lib/marketing-exposure";
import { maskProductFieldsForViewer } from "@/lib/product-field-visibility";
import { isTrade82TeamAccount } from "@/lib/trade82-team";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile().catch(() => null);
    const admin = profile ? await isAdminUser().catch(() => false) : false;
    const productIds = await listActiveMarketingProductIds(100);

    if (!productIds.length) {
      return Response.json({ products: [] });
    }

    const products = await getDb().product.findMany({
      where: {
        id: { in: productIds },
        status: "active",
        deletedAt: null,
        sellerCompany: {
          verificationStatus: "verified",
          deletedAt: null,
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
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const orderedProducts = productIds
      .map((id) => productById.get(id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product));

    return Response.json({
      products: orderedProducts.map((product) => {
        const canViewSensitiveFields =
          admin || Boolean(profile?.id && product.sellerCompany.ownerUserId === profile.id);
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
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
