import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import {
  getComplianceClaimOptions,
  getIncotermOptions,
  getKoreanRegionOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getPriceUnitOptions,
  getPrivateLabelOptions,
  getSampleAvailabilityOptions,
  getSalesChannelOptions,
  getSellerDocumentOptions,
  SOUTH_KOREA,
  type SelectOption,
} from "@/lib/company-select-options";
import { getDb } from "@/lib/db";
import {
  cleanPlainText,
  cleanTags,
  isMarketplaceCategory,
  parseUploadedImages,
} from "@/lib/marketplace";
import { parseProductFieldVisibilityInput } from "@/lib/product-field-visibility";

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionValues(options: SelectOption[]) {
  return new Set(options.map((option) => option.value));
}

function allowedOption(value: unknown, options: SelectOption[], fallback = "") {
  const text = cleanPlainText(value, 120);
  return optionValues(options).has(text) ? text : fallback;
}

function allowedList(value: unknown, options: SelectOption[]) {
  const allowed = optionValues(options);
  return Array.from(
    new Set(
      strings(value)
        .map((item) => cleanPlainText(item, 120))
        .filter((item) => allowed.has(item)),
    ),
  );
}

function optionalPositiveText(value: unknown, maxLength = 80) {
  const text = cleanPlainText(value, maxLength);
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? text : "";
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

    const name = cleanPlainText(body.name, 120);
    const category = cleanPlainText(body.category, 80);
    const detailedDescription = cleanPlainText(body.detailedDescription, 5000);
    const priceMin = Number(body.priceMin);
    const priceMax = body.priceMax === null || body.priceMax === undefined || body.priceMax === ""
      ? null
      : Number(body.priceMax);
    const moqQuantity = optionalPositiveText(body.moqQuantity);
    const moqUnit = allowedOption(body.moqUnit, getMoqUnitOptions("en"), "Units");
    const leadTime = allowedOption(body.leadTime, getLeadTimeOptions("en"));
    const images = parseUploadedImages(body.images);
    const fieldVisibility = parseProductFieldVisibilityInput(body.fieldVisibility);

    if (!name) {
      return Response.json({ error: "상품명을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (!isMarketplaceCategory(category)) {
      return Response.json({ error: "카테고리를 선택해 주시기 바랍니다." }, { status: 400 });
    }
    if (!Number.isFinite(priceMin) || priceMin <= 0) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (priceMax !== null && (!Number.isFinite(priceMax) || priceMax < 0)) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (moqUnit !== "Not fixed" && (!moqQuantity || Number(moqQuantity) <= 0)) {
      return Response.json({ error: "MOQ를 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (!leadTime) {
      return Response.json({ error: "리드타임을 선택해 주시기 바랍니다." }, { status: 400 });
    }
    if (!detailedDescription) {
      return Response.json({ error: "상품 설명을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (!images.length) {
      return Response.json(
        { error: "상품 이미지를 한 장 이상 등록해 주시기 바랍니다." },
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
        priceMax: priceMax === null ? null : String(priceMax),
        currency: cleanPlainText(body.currency, 8) || "USD",
        priceUnit: allowedOption(body.priceUnit, getPriceUnitOptions("en"), "unit"),
        moq:
          cleanPlainText(body.moq, 120) ||
          (moqUnit === "Not fixed" ? "Not fixed" : `${moqQuantity} ${moqUnit}`),
        moqQuantity,
        moqUnit,
        leadTime,
        leadTimeCode: leadTime,
        sampleAvailability: allowedOption(
          body.sampleAvailability,
          getSampleAvailabilityOptions("en"),
        ),
        privateLabelAvailability: allowedOption(
          body.privateLabelAvailability,
          getPrivateLabelOptions("en"),
        ),
        monthlyCapacity: optionalPositiveText(body.monthlyCapacity),
        monthlyCapacityUnit: allowedOption(
          body.monthlyCapacityUnit,
          getPriceUnitOptions("en"),
          "unit",
        ),
        origin: SOUTH_KOREA,
        countryOfOrigin: SOUTH_KOREA,
        shippingOriginCountry: SOUTH_KOREA,
        shippingOriginRegion: allowedOption(
          body.shippingOriginRegion,
          getKoreanRegionOptions("en"),
        ),
        incoterms: allowedList(body.incoterms, getIncotermOptions("en")),
        hsCode: cleanPlainText(body.hsCode, 40),
        shelfLife: cleanPlainText(body.shelfLife, 120),
        storageRequirements: cleanPlainText(body.storageRequirements, 1000),
        documentsAvailable: allowedList(
          body.documentsAvailable,
          getSellerDocumentOptions("en"),
        ),
        complianceClaims: allowedList(
          body.complianceClaims,
          getComplianceClaimOptions("en"),
        ),
        buyerNotes: cleanPlainText(body.buyerNotes, 1000),
        riskNotes: strings(body.riskNotes).map((item) => cleanPlainText(item, 300)).filter(Boolean),
        certifications: allowedList(
          body.complianceClaims ?? body.certifications,
          getComplianceClaimOptions("en"),
        ),
        ingredientsOrMaterials: cleanPlainText(
          body.ingredientsOrMaterials,
          1000,
        ),
        packaging: cleanPlainText(body.packaging, 1000),
        packageSize: cleanPlainText(body.packageSize, 120),
        unitsPerCarton: optionalPositiveText(body.unitsPerCarton),
        cartonWeight: cleanPlainText(body.cartonWeight, 120),
        cartonDimensions: cleanPlainText(body.cartonDimensions, 120),
        palletQuantity: optionalPositiveText(body.palletQuantity),
        storageTemperature: cleanPlainText(body.storageTemperature, 120),
        suggestedUsChannels: allowedList(
          body.suggestedUsChannels,
          getSalesChannelOptions("en"),
        ),
        fieldVisibility,
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
    if (error instanceof Error && /[가-힣]/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}
