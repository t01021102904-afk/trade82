import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  readJsonObject,
  requiredIdField,
  validationErrorResponse,
} from "@/lib/api-security";
import { isAdminUser, requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

async function requireSavedItemsAccess() {
  const user = await requireAuth();
  const admin = await isAdminUser();
  if (!admin && user.role !== "buyer" && user.role !== "both") {
    throw new Response("Buyer role required", { status: 403 });
  }
  return { user, admin };
}

export async function GET() {
  try {
    const { user } = await requireSavedItemsAccess();
    const items = await getDb().savedItem.findMany({
      where: {
        userId: user.id,
        OR: [
          {
            product: {
              deletedAt: null,
              sellerCompany: { deletedAt: null },
            },
          },
          { company: { deletedAt: null } },
        ],
      },
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
      items
        .filter((item) => item.product || item.company)
        .map((item) => ({
          ...item,
          targetId: item.productId || item.companyId,
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
    const { user, admin } = await requireSavedItemsAccess();

    const rateLimit = checkRateLimit(`saves:${user.id}`, 60, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many save/unsave actions. Please slow down." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const body = await readJsonObject(request);
    const type = enumField(body, "type", ["company", "product"], "product");
    const targetId = requiredIdField(body, "id");
    const target = await resolveTarget(type, targetId, admin);
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
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}

async function resolveTarget(
  type: "product" | "company",
  targetId: string,
  admin = false,
) {
  if (type === "product") {
    const product = await getDb().product.findFirst({
      where: {
        id: targetId,
        ...(admin
          ? {}
          : {
              status: "active",
              deletedAt: null,
              sellerCompany: {
                verificationStatus: "verified",
                deletedAt: null,
              },
            }),
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
    return null;
  }

  const company = await getDb().company.findFirst({
    where: {
      id: targetId,
      ...(admin ? {} : { verificationStatus: "verified" }),
      deletedAt: null,
    },
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
  return null;
}
