import { apiError } from "@/lib/api-response";
import { requireBuyer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  publicBuyers,
  publicProducts,
  publicSellers,
} from "@/lib/mock-data";

export async function GET() {
  try {
    const { user } = await requireBuyer();
    const items = await getDb().savedItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            sellerCompany: true,
          },
        },
        company: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(
      items.map((item) => ({
        ...item,
        targetId: item.productId || item.companyId || item.externalId,
        displayName:
          item.displayName ||
          item.product?.name ||
          item.company?.tradeName ||
          item.company?.legalName,
        imageUrl:
          item.imageUrl ||
          item.product?.images[0]?.cardUrl ||
          item.product?.imageUrl ||
          item.company?.logoThumbnailUrl ||
          item.company?.logoUrl,
        href:
          item.href ||
          (item.productId
            ? `/products/${item.productId}`
            : `/companies/${item.companyId}`),
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireBuyer();
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type === "company" ? "company" : "product";
    const targetId = String(body.id ?? "");
    const target = await resolveTarget(type, targetId);
    if (!target) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await getDb().savedItem.findFirst({
      where: target.dbId
        ? type === "product"
          ? { userId: user.id, productId: target.dbId }
          : { userId: user.id, companyId: target.dbId }
        : { userId: user.id, type, externalId: targetId },
    });
    if (existing) {
      await getDb().savedItem.delete({ where: { id: existing.id } });
      return Response.json({ saved: false, message: "Removed" });
    }

    await getDb().savedItem.create({
      data: {
        userId: user.id,
        type,
        productId: type === "product" ? target.dbId : null,
        companyId: type === "company" ? target.dbId : null,
        externalId: target.dbId ? null : targetId,
        displayName: target.displayName,
        imageUrl: target.imageUrl,
        href: target.href,
      },
    });
    return Response.json({ saved: true, message: "Saved" });
  } catch (error) {
    return apiError(error);
  }
}

async function resolveTarget(type: "product" | "company", targetId: string) {
  if (type === "product") {
    const product = await getDb().product.findFirst({
      where: {
        id: targetId,
        status: "active",
        sellerCompany: { verificationStatus: "verified" },
      },
      select: { id: true, name: true, imageUrl: true },
    });
    if (product) {
      return {
        dbId: product.id,
        displayName: product.name,
        imageUrl: product.imageUrl,
        href: `/products/${product.id}`,
      };
    }
    const catalogProduct = publicProducts.find((item) => item.id === targetId);
    return catalogProduct
      ? {
          dbId: null,
          displayName: catalogProduct.name,
          imageUrl: catalogProduct.imagePlaceholder,
          href: `/products/${catalogProduct.id}`,
        }
      : null;
  }

  const company = await getDb().company.findFirst({
    where: { id: targetId, verificationStatus: "verified" },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      logoThumbnailUrl: true,
      logoUrl: true,
      companyRole: true,
    },
  });
  if (company) {
    return {
      dbId: company.id,
      displayName: company.tradeName || company.legalName,
      imageUrl: company.logoThumbnailUrl || company.logoUrl,
      href:
        company.companyRole === "buyer"
          ? `/buyers/${company.id}`
          : `/companies/${company.id}`,
    };
  }
  const catalogCompany =
    publicSellers.find((item) => item.id === targetId) ||
    publicBuyers.find((item) => item.id === targetId);
  return catalogCompany
    ? {
        dbId: null,
        displayName: catalogCompany.name,
        imageUrl: catalogCompany.logoUrl ?? null,
        href:
          "buyerType" in catalogCompany
            ? `/buyers/${catalogCompany.id}`
            : `/companies/${catalogCompany.id}`,
      }
    : null;
}
