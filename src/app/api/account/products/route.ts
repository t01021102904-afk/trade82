import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { parseUploadedImages } from "@/lib/marketplace";
import { createProductSlug, normalizeProductInput } from "@/lib/product-input";

export async function GET() {
  try {
    const { user } = await requireSeller();
    const products = await getDb().product.findMany({
      where: { sellerCompany: { ownerUserId: user.id } },
      include: {
        images: { orderBy: { position: "asc" } },
        sellerCompany: {
          select: { verificationStatus: true, legalName: true, tradeName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json(
      products.map((product) => ({
        ...product,
        priceMin: product.priceMin?.toString() ?? null,
        priceMax: product.priceMax?.toString() ?? null,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { company } = await requireSeller();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-write",
      userId: company?.ownerUserId,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as Record<string, unknown>;

    if (!company) {
      return Response.json(
        { error: "이 기능은 한국 셀러 계정에서 사용할 수 있습니다." },
        { status: 403 },
      );
    }

    const images = parseUploadedImages(body.images);
    const status =
      body.status === "inactive" || body.status === "draft"
        ? body.status
        : "active";
    const productInput = normalizeProductInput(body, {
      status,
      hasImages: images.length > 0,
    });
    const firstImage = images[0];
    const product = await getDb().product.create({
      data: {
        sellerCompanyId: company.id,
        slug: `${createProductSlug(productInput.name) || "product"}-${crypto.randomUUID().slice(0, 8)}`,
        imageUrl: firstImage?.cardUrl ?? null,
        ...productInput,
        images: images.length
          ? {
              create: images.map((image) => ({
                originalUrl: image.originalUrl,
                cardUrl: image.cardUrl,
                mainUrl: image.mainUrl,
                detailUrl: image.detailUrl,
                storagePath: image.storagePath,
                position: image.position,
                width: image.width,
                height: image.height,
                altText: productInput.name,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { position: "asc" } },
        sellerCompany: {
          select: { verificationStatus: true, legalName: true, tradeName: true },
        },
      },
    });

    return Response.json(
      {
        ...product,
        priceMin: product.priceMin?.toString() ?? null,
        priceMax: product.priceMax?.toString() ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && /[가-힣]/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}
