import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idField,
  isPlainObject,
  rateLimitOrResponse,
  readJsonObject,
  stringArrayField,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { getCurrentUserProfile, isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  generateEnglishTranslation,
  TranslationProviderError,
  TranslationProviderMissingError,
  type CompanyEnglishTranslationPayload,
  type ProductEnglishTranslationPayload,
} from "@/lib/english-translation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "english-translation",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const type = body.type;
    if (type !== "product" && type !== "company") {
      throw validationError("type is invalid.");
    }
    if (!isPlainObject(body.payload)) {
      throw validationError("payload must be a JSON object.");
    }

    const admin = await isAdminUser().catch(() => false);
    if (type === "product") {
      await authorizeProductTranslation(body, user.id, admin);
      const translation = await generateEnglishTranslation({
        type,
        payload: productPayload(body.payload),
      });
      return Response.json(translation);
    }

    await authorizeCompanyTranslation(body, user.id, user.role, admin);
    const translation = await generateEnglishTranslation({
      type,
      payload: companyPayload(body.payload),
    });
    return Response.json(translation);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    if (error instanceof TranslationProviderMissingError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof TranslationProviderError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error);
  }
}

async function authorizeProductTranslation(
  body: Record<string, unknown>,
  userId: string,
  admin: boolean,
) {
  const productId = idField(body, "productId");
  if (productId) {
    const product = await getDb().product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        deletedAt: true,
        sellerCompany: { select: { ownerUserId: true } },
      },
    });
    if (!product || product.deletedAt) {
      throw new Response("Not found", { status: 404 });
    }
    if (!admin && product.sellerCompany.ownerUserId !== userId) {
      throw new Response("Forbidden", { status: 403 });
    }
    return;
  }

  if (admin) return;
  const company = await getDb().company.findFirst({
    where: { ownerUserId: userId, companyRole: "seller", deletedAt: null },
    select: { id: true },
  });
  if (!company) {
    throw new Response("Seller company required", { status: 403 });
  }
}

async function authorizeCompanyTranslation(
  body: Record<string, unknown>,
  userId: string,
  userRole: string,
  admin: boolean,
) {
  const companyId = idField(body, "companyId");
  if (companyId) {
    const company = await getDb().company.findUnique({
      where: { id: companyId },
      select: { id: true, companyRole: true, ownerUserId: true, deletedAt: true },
    });
    if (!company || company.deletedAt || company.companyRole !== "seller") {
      throw new Response("Not found", { status: 404 });
    }
    if (!admin && company.ownerUserId !== userId) {
      throw new Response("Forbidden", { status: 403 });
    }
    return;
  }

  if (admin || userRole === "seller" || userRole === "both") return;
  throw new Response("Seller role required", { status: 403 });
}

function productPayload(
  source: Record<string, unknown>,
): ProductEnglishTranslationPayload {
  return {
    name: stringField(source, "name", { max: 120, fallback: "" }) ?? "",
    shortDescription:
      stringField(source, "shortDescription", { max: 240, fallback: "" }) ?? "",
    detailedDescription:
      stringField(source, "detailedDescription", { max: 5_000, fallback: "" }) ?? "",
    buyerNotes:
      stringField(source, "buyerNotes", { max: 1_000, fallback: "" }) ?? "",
    tags: stringArrayField(source, "tags", {
      maxItems: 10,
      maxLength: 30,
      fallback: [],
    }),
  };
}

function companyPayload(
  source: Record<string, unknown>,
): CompanyEnglishTranslationPayload {
  return {
    companyName:
      stringField(source, "companyName", { max: 160, fallback: "" }) ?? "",
    description:
      stringField(source, "description", { max: 2_000, fallback: "" }) ?? "",
    exportExperience:
      stringField(source, "exportExperience", { max: 10_000, fallback: "" }) ??
      "",
  };
}
