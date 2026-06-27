import { apiError } from "@/lib/api-response";
import { ApiValidationError, idParam, rateLimitOrResponse, validationErrorResponse } from "@/lib/api-security";
import { canManageProduct, requireSeller } from "@/lib/authz";
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
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-write",
      userId: user.id,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "productId");
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
    const priceMin =
      body.priceMin === null || body.priceMin === undefined || body.priceMin === ""
        ? null
        : Number(body.priceMin);
    const priceMax =
      body.priceMax === null || body.priceMax === undefined || body.priceMax === ""
        ? null
        : Number(body.priceMax);
    const moqQuantity =
      body.moqQuantity === undefined ? undefined : optionalPositiveText(body.moqQuantity);
    const moqUnit =
      body.moqUnit === undefined
        ? undefined
        : allowedOption(body.moqUnit, getMoqUnitOptions("en"), "Units");
    const leadTime =
      body.leadTime === undefined
        ? undefined
        : allowedOption(body.leadTime, getLeadTimeOptions("en"));

    if (
      category !== undefined &&
      !isMarketplaceCategory(category)
    ) {
      return Response.json({ error: "카테고리를 선택해 주시기 바랍니다." }, { status: 400 });
    }
    if (images && !images.length) {
      return Response.json(
        { error: "상품 이미지를 한 장 이상 등록해 주시기 바랍니다." },
        { status: 400 },
      );
    }
    if (priceMin !== null && priceMin !== undefined && (!Number.isFinite(priceMin) || priceMin <= 0)) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (priceMax !== null && priceMax !== undefined && (!Number.isFinite(priceMax) || priceMax < 0)) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (
      moqUnit !== undefined &&
      moqUnit !== "Not fixed" &&
      (!moqQuantity || Number(moqQuantity) <= 0)
    ) {
      return Response.json({ error: "MOQ를 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (leadTime !== undefined && !leadTime) {
      return Response.json({ error: "리드타임을 선택해 주시기 바랍니다." }, { status: 400 });
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
              ? String(priceMin)
              : undefined,
        priceMax:
          body.priceMax === null
            ? null
            : body.priceMax !== undefined
              ? priceMax === null ? null : String(priceMax)
              : undefined,
        currency:
          typeof body.currency === "string"
            ? cleanPlainText(body.currency, 8)
            : undefined,
        priceUnit:
          body.priceUnit === undefined
            ? undefined
            : allowedOption(body.priceUnit, getPriceUnitOptions("en"), "unit"),
        moq:
          typeof body.moq === "string"
            ? cleanPlainText(body.moq, 120)
            : moqQuantity !== undefined && moqUnit !== undefined
              ? moqUnit === "Not fixed"
                ? "Not fixed"
                : `${moqQuantity} ${moqUnit}`
            : undefined,
        moqQuantity,
        moqUnit,
        leadTime:
          leadTime === undefined
            ? undefined
            : leadTime,
        leadTimeCode: leadTime,
        sampleAvailability:
          body.sampleAvailability === undefined
            ? undefined
            : allowedOption(body.sampleAvailability, getSampleAvailabilityOptions("en")),
        privateLabelAvailability:
          body.privateLabelAvailability === undefined
            ? undefined
            : allowedOption(body.privateLabelAvailability, getPrivateLabelOptions("en")),
        monthlyCapacity:
          body.monthlyCapacity === undefined
            ? undefined
            : optionalPositiveText(body.monthlyCapacity),
        monthlyCapacityUnit:
          body.monthlyCapacityUnit === undefined
            ? undefined
            : allowedOption(body.monthlyCapacityUnit, getPriceUnitOptions("en"), "unit"),
        origin: SOUTH_KOREA,
        countryOfOrigin: SOUTH_KOREA,
        shippingOriginCountry: SOUTH_KOREA,
        shippingOriginRegion:
          body.shippingOriginRegion === undefined
            ? undefined
            : allowedOption(body.shippingOriginRegion, getKoreanRegionOptions("en")),
        incoterms:
          body.incoterms === undefined
            ? undefined
            : allowedList(body.incoterms, getIncotermOptions("en")),
        hsCode:
          typeof body.hsCode === "string"
            ? cleanPlainText(body.hsCode, 40)
            : undefined,
        shelfLife:
          typeof body.shelfLife === "string"
            ? cleanPlainText(body.shelfLife, 120)
            : undefined,
        storageRequirements:
          typeof body.storageRequirements === "string"
            ? cleanPlainText(body.storageRequirements, 1000)
            : undefined,
        documentsAvailable:
          body.documentsAvailable === undefined
            ? undefined
            : allowedList(body.documentsAvailable, getSellerDocumentOptions("en")),
        complianceClaims:
          body.complianceClaims === undefined
            ? undefined
            : allowedList(body.complianceClaims, getComplianceClaimOptions("en")),
        buyerNotes:
          typeof body.buyerNotes === "string"
            ? cleanPlainText(body.buyerNotes, 1000)
            : undefined,
        riskNotes:
          body.riskNotes === undefined
            ? undefined
            : strings(body.riskNotes).map((item) => cleanPlainText(item, 300)).filter(Boolean),
        certifications: body.complianceClaims
          ? allowedList(body.complianceClaims, getComplianceClaimOptions("en"))
          : body.certifications
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
        packageSize:
          typeof body.packageSize === "string"
            ? cleanPlainText(body.packageSize, 120)
            : undefined,
        unitsPerCarton:
          body.unitsPerCarton === undefined
            ? undefined
            : optionalPositiveText(body.unitsPerCarton),
        cartonWeight:
          typeof body.cartonWeight === "string"
            ? cleanPlainText(body.cartonWeight, 120)
            : undefined,
        cartonDimensions:
          typeof body.cartonDimensions === "string"
            ? cleanPlainText(body.cartonDimensions, 120)
            : undefined,
        palletQuantity:
          body.palletQuantity === undefined
            ? undefined
            : optionalPositiveText(body.palletQuantity),
        storageTemperature:
          typeof body.storageTemperature === "string"
            ? cleanPlainText(body.storageTemperature, 120)
            : undefined,
        suggestedUsChannels:
          body.suggestedUsChannels === undefined
            ? undefined
            : allowedList(body.suggestedUsChannels, getSalesChannelOptions("en")),
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
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    if (error instanceof Error && /[가-힣]/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireSeller();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-products-delete",
      userId: user.id,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "productId");
    const existing = await ownProduct(id, user.id);
    if (!canManageProduct(user, existing)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await getDb().product.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
