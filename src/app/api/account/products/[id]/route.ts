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
import {
  normalizeProductFieldVisibility,
  parseProductFieldVisibilityInput,
  productFieldRequiresValue,
} from "@/lib/product-field-visibility";

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

function publicFieldRequiredResponse() {
  return Response.json(
    { error: "공개 항목으로 설정한 경우 입력이 필요합니다." },
    { status: 400 },
  );
}

async function ownProduct(id: string, userId: string) {
  return getDb().product.findFirst({
    where: {
      id,
      deletedAt: null,
      sellerCompany: { ownerUserId: userId, deletedAt: null },
    },
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
    if (!existing || !canManageProduct(user, existing)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const fieldVisibility =
      body.fieldVisibility === undefined
        ? undefined
        : parseProductFieldVisibilityInput(body.fieldVisibility);
    const effectiveFieldVisibility =
      fieldVisibility ?? normalizeProductFieldVisibility(existing.fieldVisibility);
    const priceIsPublic = productFieldRequiresValue(
      effectiveFieldVisibility,
      "minimumUnitPrice",
    );
    const moqIsPublic = productFieldRequiresValue(effectiveFieldVisibility, "moq");
    const leadTimeIsPublic = productFieldRequiresValue(
      effectiveFieldVisibility,
      "leadTime",
    );
    const images =
      body.images === undefined ? undefined : parseUploadedImages(body.images);
    const category =
      typeof body.category === "string"
        ? cleanPlainText(body.category, 80)
        : undefined;
    const priceMin =
      body.priceMin === undefined
        ? fieldVisibility && !priceIsPublic
          ? null
          : undefined
        : !priceIsPublic ||
            body.priceMin === null ||
            body.priceMin === ""
          ? null
          : Number(body.priceMin);
    const priceMax =
      body.priceMax === undefined
        ? fieldVisibility && !priceIsPublic
          ? null
          : undefined
        : !priceIsPublic ||
            body.priceMax === null ||
            body.priceMax === ""
          ? null
          : Number(body.priceMax);
    const moqQuantity =
      body.moqQuantity === undefined
        ? fieldVisibility && !moqIsPublic
          ? ""
          : undefined
        : moqIsPublic
          ? optionalPositiveText(body.moqQuantity)
          : "";
    const moqUnit =
      body.moqUnit === undefined
        ? undefined
        : allowedOption(body.moqUnit, getMoqUnitOptions("en"), "Units");
    const leadTime =
      body.leadTime === undefined
        ? fieldVisibility && !leadTimeIsPublic
          ? ""
          : undefined
        : leadTimeIsPublic
          ? allowedOption(body.leadTime, getLeadTimeOptions("en"))
          : "";

    if (
      category !== undefined &&
      !isMarketplaceCategory(category)
    ) {
      return Response.json({ error: "카테고리를 선택해 주시기 바랍니다." }, { status: 400 });
    }
    if (
      priceIsPublic &&
      priceMin !== null &&
      priceMin !== undefined &&
      (!Number.isFinite(priceMin) || priceMin <= 0)
    ) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (
      priceIsPublic &&
      priceMax !== null &&
      priceMax !== undefined &&
      (!Number.isFinite(priceMax) || priceMax < 0)
    ) {
      return Response.json({ error: "올바른 가격을 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (
      moqIsPublic &&
      moqUnit !== undefined &&
      moqUnit !== "Not fixed" &&
      (!moqQuantity || Number(moqQuantity) <= 0)
    ) {
      return Response.json({ error: "MOQ를 입력해 주시기 바랍니다." }, { status: 400 });
    }
    if (leadTimeIsPublic && leadTime !== undefined && !leadTime) {
      return Response.json({ error: "리드타임을 선택해 주시기 바랍니다." }, { status: 400 });
    }
    if (fieldVisibility) {
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "sampleAvailability") &&
        !allowedOption(
          body.sampleAvailability ?? existing.sampleAvailability,
          getSampleAvailabilityOptions("en"),
        )
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "privateLabelAvailability") &&
        !allowedOption(
          body.privateLabelAvailability ?? existing.privateLabelAvailability,
          getPrivateLabelOptions("en"),
        )
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "monthlySupplyCapacity") &&
        !optionalPositiveText(body.monthlyCapacity ?? existing.monthlyCapacity)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "incoterms") &&
        !allowedList(body.incoterms ?? existing.incoterms, getIncotermOptions("en")).length
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "hsCode") &&
        !cleanPlainText(body.hsCode ?? existing.hsCode, 40)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "shelfLife") &&
        !cleanPlainText(body.shelfLife ?? existing.shelfLife, 120)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "storageRequirements") &&
        !cleanPlainText(body.storageRequirements ?? existing.storageRequirements, 1000)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "documents") &&
        !allowedList(
          body.documentsAvailable ?? existing.documentsAvailable,
          getSellerDocumentOptions("en"),
        ).length
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "complianceInfo") &&
        !allowedList(
          body.complianceClaims ?? existing.complianceClaims,
          getComplianceClaimOptions("en"),
        ).length
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "ingredientsMaterials") &&
        !cleanPlainText(body.ingredientsOrMaterials ?? existing.ingredientsOrMaterials, 1000)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "packageSize") &&
        !cleanPlainText(body.packageSize ?? existing.packageSize, 120)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "unitsPerCarton") &&
        !optionalPositiveText(body.unitsPerCarton ?? existing.unitsPerCarton)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "cartonWeight") &&
        !cleanPlainText(body.cartonWeight ?? existing.cartonWeight, 120)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "cartonDimensions") &&
        !cleanPlainText(body.cartonDimensions ?? existing.cartonDimensions, 120)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "palletQuantity") &&
        !optionalPositiveText(body.palletQuantity ?? existing.palletQuantity)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "storageTemperature") &&
        !cleanPlainText(body.storageTemperature ?? existing.storageTemperature, 120)
      ) {
        return publicFieldRequiredResponse();
      }
      if (
        productFieldRequiresValue(effectiveFieldVisibility, "packaging") &&
        !cleanPlainText(body.packaging ?? existing.packaging, 1000)
      ) {
        return publicFieldRequiredResponse();
      }
    }

    const product = await getDb().product.update({
      where: { id },
      data: {
        name:
          typeof body.name === "string"
            ? cleanPlainText(body.name, 120)
            : undefined,
        nameEn:
          typeof body.nameEn === "string"
            ? cleanPlainText(body.nameEn, 120)
            : undefined,
        imageUrl: images ? images[0]?.cardUrl ?? null : undefined,
        category,
        tags: body.tags === undefined ? undefined : cleanTags(body.tags),
        tagsEn: body.tagsEn === undefined ? undefined : cleanTags(body.tagsEn),
        shortDescription:
          typeof body.shortDescription === "string"
            ? cleanPlainText(body.shortDescription, 240)
            : undefined,
        shortDescriptionEn:
          typeof body.shortDescriptionEn === "string"
            ? cleanPlainText(body.shortDescriptionEn, 240)
            : undefined,
        detailedDescription:
          typeof body.detailedDescription === "string"
            ? cleanPlainText(body.detailedDescription, 5000)
            : undefined,
        detailedDescriptionEn:
          typeof body.detailedDescriptionEn === "string"
            ? cleanPlainText(body.detailedDescriptionEn, 5000)
            : undefined,
        priceMin:
          priceMin === undefined
            ? undefined
            : priceMin === null
              ? null
              : String(priceMin),
        priceMax:
          priceMax === undefined
            ? undefined
            : priceMax === null
              ? null
              : String(priceMax),
        currency:
          typeof body.currency === "string"
            ? cleanPlainText(body.currency, 8)
            : undefined,
        priceUnit:
          body.priceUnit === undefined
            ? undefined
            : allowedOption(body.priceUnit, getPriceUnitOptions("en"), "unit"),
        moq:
          !moqIsPublic && fieldVisibility
            ? ""
            : typeof body.moq === "string"
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
          !productFieldRequiresValue(effectiveFieldVisibility, "sampleAvailability") &&
          fieldVisibility
            ? ""
            : body.sampleAvailability === undefined
              ? undefined
              : allowedOption(body.sampleAvailability, getSampleAvailabilityOptions("en")),
        privateLabelAvailability:
          !productFieldRequiresValue(
            effectiveFieldVisibility,
            "privateLabelAvailability",
          ) && fieldVisibility
            ? ""
            : body.privateLabelAvailability === undefined
              ? undefined
              : allowedOption(body.privateLabelAvailability, getPrivateLabelOptions("en")),
        monthlyCapacity:
          !productFieldRequiresValue(effectiveFieldVisibility, "monthlySupplyCapacity") &&
          fieldVisibility
            ? ""
            : body.monthlyCapacity === undefined
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
          !productFieldRequiresValue(effectiveFieldVisibility, "incoterms") &&
          fieldVisibility
            ? []
            : body.incoterms === undefined
              ? undefined
              : allowedList(body.incoterms, getIncotermOptions("en")),
        hsCode:
          !productFieldRequiresValue(effectiveFieldVisibility, "hsCode") &&
          fieldVisibility
            ? ""
            : typeof body.hsCode === "string"
              ? cleanPlainText(body.hsCode, 40)
              : undefined,
        shelfLife:
          !productFieldRequiresValue(effectiveFieldVisibility, "shelfLife") &&
          fieldVisibility
            ? ""
            : typeof body.shelfLife === "string"
              ? cleanPlainText(body.shelfLife, 120)
              : undefined,
        storageRequirements:
          !productFieldRequiresValue(effectiveFieldVisibility, "storageRequirements") &&
          fieldVisibility
            ? ""
            : typeof body.storageRequirements === "string"
              ? cleanPlainText(body.storageRequirements, 1000)
              : undefined,
        documentsAvailable:
          !productFieldRequiresValue(effectiveFieldVisibility, "documents") &&
          fieldVisibility
            ? []
            : body.documentsAvailable === undefined
              ? undefined
              : allowedList(body.documentsAvailable, getSellerDocumentOptions("en")),
        complianceClaims:
          !productFieldRequiresValue(effectiveFieldVisibility, "complianceInfo") &&
          fieldVisibility
            ? []
            : body.complianceClaims === undefined
              ? undefined
              : allowedList(body.complianceClaims, getComplianceClaimOptions("en")),
        buyerNotes:
          typeof body.buyerNotes === "string"
            ? cleanPlainText(body.buyerNotes, 1000)
            : undefined,
        buyerNotesEn:
          typeof body.buyerNotesEn === "string"
            ? cleanPlainText(body.buyerNotesEn, 1000)
            : undefined,
        riskNotes:
          body.riskNotes === undefined
            ? undefined
            : strings(body.riskNotes).map((item) => cleanPlainText(item, 300)).filter(Boolean),
        certifications:
          !productFieldRequiresValue(effectiveFieldVisibility, "complianceInfo") &&
          fieldVisibility
            ? []
            : body.complianceClaims
              ? allowedList(body.complianceClaims, getComplianceClaimOptions("en"))
              : body.certifications
                ? strings(body.certifications)
                : undefined,
        ingredientsOrMaterials:
          !productFieldRequiresValue(effectiveFieldVisibility, "ingredientsMaterials") &&
          fieldVisibility
            ? ""
            : typeof body.ingredientsOrMaterials === "string"
              ? cleanPlainText(body.ingredientsOrMaterials, 1000)
              : undefined,
        packaging:
          !productFieldRequiresValue(effectiveFieldVisibility, "packaging") &&
          fieldVisibility
            ? ""
            : typeof body.packaging === "string"
              ? cleanPlainText(body.packaging, 1000)
              : undefined,
        packageSize:
          !productFieldRequiresValue(effectiveFieldVisibility, "packageSize") &&
          fieldVisibility
            ? ""
            : typeof body.packageSize === "string"
              ? cleanPlainText(body.packageSize, 120)
              : undefined,
        unitsPerCarton:
          !productFieldRequiresValue(effectiveFieldVisibility, "unitsPerCarton") &&
          fieldVisibility
            ? ""
            : body.unitsPerCarton === undefined
              ? undefined
              : optionalPositiveText(body.unitsPerCarton),
        cartonWeight:
          !productFieldRequiresValue(effectiveFieldVisibility, "cartonWeight") &&
          fieldVisibility
            ? ""
            : typeof body.cartonWeight === "string"
              ? cleanPlainText(body.cartonWeight, 120)
              : undefined,
        cartonDimensions:
          !productFieldRequiresValue(effectiveFieldVisibility, "cartonDimensions") &&
          fieldVisibility
            ? ""
            : typeof body.cartonDimensions === "string"
              ? cleanPlainText(body.cartonDimensions, 120)
              : undefined,
        palletQuantity:
          !productFieldRequiresValue(effectiveFieldVisibility, "palletQuantity") &&
          fieldVisibility
            ? ""
            : body.palletQuantity === undefined
              ? undefined
              : optionalPositiveText(body.palletQuantity),
        storageTemperature:
          !productFieldRequiresValue(effectiveFieldVisibility, "storageTemperature") &&
          fieldVisibility
            ? ""
            : typeof body.storageTemperature === "string"
              ? cleanPlainText(body.storageTemperature, 120)
              : undefined,
        suggestedUsChannels:
          body.suggestedUsChannels === undefined
            ? undefined
            : allowedList(body.suggestedUsChannels, getSalesChannelOptions("en")),
        fieldVisibility:
          fieldVisibility,
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
