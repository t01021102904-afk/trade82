import { apiError } from "@/lib/api-response";
import { canManageProduct, requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  cleanPlainText,
  cleanTags,
  marketplaceCategories,
  parseUploadedImages,
} from "@/lib/marketplace";

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function ownProduct(id: string, userId: string) {
  return getDb().product.findFirst({
    where: { id, sellerCompany: { ownerUserId: userId } },
    include: { sellerCompany: true },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireSeller();
    const { id } = await params;
    const existing = await ownProduct(id, user.id);
    if (!canManageProduct(user, existing)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const images =
      body.images === undefined ? undefined : parseUploadedImages(body.images);
    const category =
      typeof body.category === "string"
        ? cleanPlainText(body.category, 80)
        : undefined;

    if (
      category !== undefined &&
      !marketplaceCategories.includes(category as never)
    ) {
      return Response.json({ error: "카테고리를 선택해 주세요." }, { status: 400 });
    }
    if (images && !images.length) {
      return Response.json(
        { error: "상품 이미지를 한 장 이상 등록해 주세요." },
        { status: 400 },
      );
    }

    const product = await getDb().product.update({
      where: { id },
      data: {
        name:
          typeof body.name === "string"
            ? cleanPlainText(body.name, 120)
            : undefined,
        imageUrl: images ? images[0].cardUrl : undefined,
        category,
        tags: body.tags === undefined ? undefined : cleanTags(body.tags),
        shortDescription:
          typeof body.shortDescription === "string"
            ? cleanPlainText(body.shortDescription, 240)
            : undefined,
        detailedDescription:
          typeof body.detailedDescription === "string"
            ? cleanPlainText(body.detailedDescription, 5000)
            : undefined,
        priceMin:
          body.priceMin === null
            ? null
            : body.priceMin !== undefined
              ? String(body.priceMin)
              : undefined,
        priceMax:
          body.priceMax === null
            ? null
            : body.priceMax !== undefined
              ? String(body.priceMax)
              : undefined,
        currency:
          typeof body.currency === "string"
            ? cleanPlainText(body.currency, 8)
            : undefined,
        moq:
          typeof body.moq === "string"
            ? cleanPlainText(body.moq, 120)
            : undefined,
        leadTime:
          typeof body.leadTime === "string"
            ? cleanPlainText(body.leadTime, 120)
            : undefined,
        certifications: body.certifications
          ? strings(body.certifications)
          : undefined,
        ingredientsOrMaterials:
          typeof body.ingredientsOrMaterials === "string"
            ? cleanPlainText(body.ingredientsOrMaterials, 1000)
            : undefined,
        packaging:
          typeof body.packaging === "string"
            ? cleanPlainText(body.packaging, 1000)
            : undefined,
        exportReadiness:
          typeof body.exportReadiness === "boolean"
            ? body.exportReadiness
            : undefined,
        status:
          body.status === "active" ||
          body.status === "inactive" ||
          body.status === "draft"
            ? body.status
            : undefined,
        images: images
          ? {
              deleteMany: {},
              create: images.map((image) => ({
                originalUrl: image.originalUrl,
                cardUrl: image.cardUrl,
                mainUrl: image.mainUrl,
                detailUrl: image.detailUrl,
                storagePath: image.storagePath,
                position: image.position,
                width: image.width,
                height: image.height,
                altText:
                  typeof body.name === "string"
                    ? cleanPlainText(body.name, 120)
                    : "",
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

    return Response.json({
      ...product,
      priceMin: product.priceMin?.toString() ?? null,
      priceMax: product.priceMax?.toString() ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("요.")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireSeller();
    const { id } = await params;
    const existing = await ownProduct(id, user.id);
    if (!canManageProduct(user, existing)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await getDb().product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
