import { apiError } from "@/lib/api-response";
import { requireSeller } from "@/lib/authz";
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
    const body = (await request.json()) as Record<string, unknown>;

    if (!company) {
      return Response.json(
        { error: "한국 셀러 계정만 상품을 등록할 수 있어요." },
        { status: 403 },
      );
    }

    const name = cleanPlainText(body.name, 120);
    const category = cleanPlainText(body.category, 80);
    const detailedDescription = cleanPlainText(body.detailedDescription, 5000);
    const priceMin = Number(body.priceMin);
    const images = parseUploadedImages(body.images);

    if (!name) {
      return Response.json({ error: "상품명을 입력해 주세요." }, { status: 400 });
    }
    if (!marketplaceCategories.includes(category as never)) {
      return Response.json({ error: "카테고리를 선택해 주세요." }, { status: 400 });
    }
    if (!Number.isFinite(priceMin) || priceMin <= 0) {
      return Response.json({ error: "가격을 입력해 주세요." }, { status: 400 });
    }
    if (!detailedDescription) {
      return Response.json({ error: "상품 설명을 입력해 주세요." }, { status: 400 });
    }
    if (!images.length) {
      return Response.json(
        { error: "상품 이미지를 한 장 이상 등록해 주세요." },
        { status: 400 },
      );
    }

    const firstImage = images[0];
    const product = await getDb().product.create({
      data: {
        sellerCompanyId: company.id,
        name,
        slug: `${slugify(name) || "product"}-${crypto.randomUUID().slice(0, 8)}`,
        imageUrl: firstImage.cardUrl,
        category,
        tags: cleanTags(body.tags),
        shortDescription:
          cleanPlainText(body.shortDescription, 240) ||
          detailedDescription.slice(0, 240),
        detailedDescription,
        priceMin: String(priceMin),
        priceMax:
          body.priceMax === null || body.priceMax === undefined
            ? null
            : String(body.priceMax),
        currency: cleanPlainText(body.currency, 8) || "USD",
        moq: cleanPlainText(body.moq, 120) || "Contact seller",
        leadTime: cleanPlainText(body.leadTime, 120) || "Contact seller",
        origin: "South Korea",
        certifications: strings(body.certifications),
        ingredientsOrMaterials: cleanPlainText(
          body.ingredientsOrMaterials,
          1000,
        ),
        packaging: cleanPlainText(body.packaging, 1000),
        exportReadiness: body.exportReadiness === true,
        status:
          body.status === "inactive" || body.status === "draft"
            ? body.status
            : "active",
        images: {
          create: images.map((image) => ({
            originalUrl: image.originalUrl,
            cardUrl: image.cardUrl,
            mainUrl: image.mainUrl,
            detailUrl: image.detailUrl,
            storagePath: image.storagePath,
            position: image.position,
            width: image.width,
            height: image.height,
            altText: name,
          })),
        },
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
    if (error instanceof Error && error.message.endsWith("요.")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}
