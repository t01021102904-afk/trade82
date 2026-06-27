import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  rateLimitOrResponse,
  readJsonObject,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireBuyer, requireSeller } from "@/lib/authz";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";
import type {
  CompanyRole,
  CompanyVerificationStatus,
} from "@/generated/prisma/client";

const criticalCompanyFields = [
  "legalName",
  "businessAddress",
  "website",
  "country",
] as const;

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function textField(
  source: Record<string, unknown>,
  key: string,
  fallback = "",
  max = 500,
) {
  if (source[key] === undefined) return fallback;
  if (typeof source[key] !== "string") {
    throw validationError(`${key} must be text.`);
  }
  const value = String(source[key]).trim();
  if (value.length > max) throw validationError(`${key} is too long.`);
  return value;
}

function nullableTextField(
  source: Record<string, unknown>,
  key: string,
  fallback: string | null = null,
  max = 500,
) {
  const value = textField(source, key, fallback ?? "", max);
  return value || null;
}

function listField(
  source: Record<string, unknown>,
  key: string,
  fallback: string[] = [],
) {
  if (!(key in source)) return fallback;
  const items = strings(source[key]);
  if (items.length > 30) throw validationError(`${key} has too many items.`);
  return items.map((item) => {
    const value = item.trim();
    if (value.length > 120) throw validationError(`${key} item is too long.`);
    return value;
  }).filter(Boolean);
}

function booleanField(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean,
) {
  return typeof source[key] === "boolean" ? source[key] : fallback;
}

function websiteField(
  source: Record<string, unknown>,
  key: string,
  fallback = "",
) {
  const raw = textField(source, key, fallback, 500);
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return url.toString();
  } catch {
    throw validationError(`${key} must be a valid URL.`);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-company-read",
      userId: user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    const companies = await getDb().company.findMany({
      where: { ownerUserId: user.id },
      include: {
        sellerProfile: true,
        buyerProfile: true,
        verificationRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            adminNote: true,
            documentFilename: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(companies);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (body.companyRole !== "seller" && body.companyRole !== "buyer") {
      throw validationError("companyRole is invalid.");
    }
    const companyRole: CompanyRole = body.companyRole;
    const { user } =
      companyRole === "seller" ? await requireSeller() : await requireBuyer();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "account-company-write",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const existing = await getDb().company.findUnique({
      where: {
        ownerUserId_companyRole: {
          ownerUserId: user.id,
          companyRole,
        },
      },
      include: { sellerProfile: true, buyerProfile: true },
    });
    const seller = (body.sellerProfile ?? {}) as Record<string, unknown>;
    const companyCriticalChanged =
      existing?.verificationStatus === "verified" &&
      criticalCompanyFields.some(
        (field) =>
          field in body &&
          String(body[field] ?? "") !== String(existing[field] ?? ""),
      );
    const sellerCriticalChanged =
      existing?.verificationStatus === "verified" &&
      companyRole === "seller" &&
      (("koreanBusinessRegistrationNumber" in seller &&
        String(seller.koreanBusinessRegistrationNumber ?? "") !==
          String(
            existing.sellerProfile?.koreanBusinessRegistrationNumber ?? "",
          )) ||
        ("representativeName" in seller &&
          String(seller.representativeName ?? "") !==
            String(existing.sellerProfile?.representativeName ?? "")));
    const criticalChanged = companyCriticalChanged || sellerCriticalChanged;
    const verificationStatus: CompanyVerificationStatus = criticalChanged
      ? "needs_reverification"
      : existing?.verificationStatus ??
        (companyRole === "seller" ? "pending_review" : "unverified");

    const company = await getDb().company.upsert({
      where: {
        ownerUserId_companyRole: {
          ownerUserId: user.id,
          companyRole,
        },
      },
      create: {
        ownerUserId: user.id,
        companyRole,
        legalName: textField(body, "legalName", "", 160),
        tradeName: nullableTextField(body, "tradeName", null, 160),
        logoOriginalUrl: nullableTextField(body, "logoOriginalUrl", null, 1_000),
        logoThumbnailUrl: nullableTextField(body, "logoThumbnailUrl", null, 1_000),
        logoUrl: nullableTextField(body, "logoUrl", null, 1_000),
        useDefaultLogo: booleanField(body, "useDefaultLogo", true),
        website: websiteField(body, "website"),
        country: textField(
          body,
          "country",
          companyRole === "seller" ? "South Korea" : "United States",
          100,
        ),
        city: textField(body, "city", "", 100),
        stateOrProvince: textField(body, "stateOrProvince", "", 100),
        businessAddress: textField(body, "businessAddress", "", 300),
        description: textField(body, "description", "", 2_000),
        categories: listField(body, "categories"),
        verificationStatus,
      },
      update: {
        legalName: textField(body, "legalName", existing?.legalName ?? "", 160),
        tradeName: nullableTextField(body, "tradeName", existing?.tradeName ?? null, 160),
        logoOriginalUrl: nullableTextField(
          body,
          "logoOriginalUrl",
          existing?.logoOriginalUrl ?? null,
          1_000,
        ),
        logoThumbnailUrl: nullableTextField(
          body,
          "logoThumbnailUrl",
          existing?.logoThumbnailUrl ?? null,
          1_000,
        ),
        logoUrl: nullableTextField(body, "logoUrl", existing?.logoUrl ?? null, 1_000),
        useDefaultLogo: booleanField(
          body,
          "useDefaultLogo",
          existing?.useDefaultLogo ?? true,
        ),
        website: websiteField(body, "website", existing?.website ?? ""),
        country: textField(body, "country", existing?.country ?? "", 100),
        city: textField(body, "city", existing?.city ?? "", 100),
        stateOrProvince: textField(
          body,
          "stateOrProvince",
          existing?.stateOrProvince ?? "",
          100,
        ),
        businessAddress: textField(
          body,
          "businessAddress",
          existing?.businessAddress ?? "",
          300,
        ),
        description: textField(body, "description", existing?.description ?? "", 2_000),
        categories: listField(body, "categories", existing?.categories ?? []),
        verificationStatus,
      },
    });

    if (companyRole === "seller") {
      await getDb().sellerProfile.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          koreanBusinessRegistrationNumber: textField(
            seller,
            "koreanBusinessRegistrationNumber",
          ),
          representativeName: textField(seller, "representativeName"),
          exportExperience: textField(seller, "exportExperience"),
          exportCountries: listField(seller, "exportCountries"),
          productCategories: listField(seller, "productCategories"),
          minimumOrderQuantity: textField(seller, "minimumOrderQuantity"),
          leadTime: textField(seller, "leadTime"),
          certifications: listField(seller, "certifications"),
          shippingTerms: listField(seller, "shippingTerms"),
          paymentTerms: listField(seller, "paymentTerms"),
          factoryOrDistributorStatus: textField(
            seller,
            "factoryOrDistributorStatus",
            "manufacturer",
          ),
        },
        update: {
          koreanBusinessRegistrationNumber: textField(
            seller,
            "koreanBusinessRegistrationNumber",
            existing?.sellerProfile?.koreanBusinessRegistrationNumber ?? "",
          ),
          representativeName: textField(
            seller,
            "representativeName",
            existing?.sellerProfile?.representativeName ?? "",
          ),
          exportExperience: textField(
            seller,
            "exportExperience",
            existing?.sellerProfile?.exportExperience ?? "",
          ),
          exportCountries: listField(
            seller,
            "exportCountries",
            existing?.sellerProfile?.exportCountries ?? [],
          ),
          productCategories: listField(
            seller,
            "productCategories",
            existing?.sellerProfile?.productCategories ?? [],
          ),
          minimumOrderQuantity: textField(
            seller,
            "minimumOrderQuantity",
            existing?.sellerProfile?.minimumOrderQuantity ?? "",
          ),
          leadTime: textField(
            seller,
            "leadTime",
            existing?.sellerProfile?.leadTime ?? "",
          ),
          certifications: listField(
            seller,
            "certifications",
            existing?.sellerProfile?.certifications ?? [],
          ),
          shippingTerms: listField(
            seller,
            "shippingTerms",
            existing?.sellerProfile?.shippingTerms ?? [],
          ),
          paymentTerms: listField(
            seller,
            "paymentTerms",
            existing?.sellerProfile?.paymentTerms ?? [],
          ),
          factoryOrDistributorStatus: textField(
            seller,
            "factoryOrDistributorStatus",
            existing?.sellerProfile?.factoryOrDistributorStatus ?? "manufacturer",
          ),
        },
      });
    } else {
      const buyer = (body.buyerProfile ?? {}) as Record<string, unknown>;
      await getDb().buyerProfile.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          buyerType: textField(buyer, "buyerType", "importer"),
          purchasingCategories: listField(buyer, "purchasingCategories"),
          preferredSupplierType: textField(buyer, "preferredSupplierType"),
          targetOrderSize: textField(buyer, "targetOrderSize"),
          monthlyImportVolume: textField(buyer, "monthlyImportVolume"),
          importExperience: textField(buyer, "importExperience"),
          purchaseTimeline: textField(buyer, "purchaseTimeline"),
          salesChannels: listField(buyer, "salesChannels"),
        },
        update: {
          buyerType: textField(
            buyer,
            "buyerType",
            existing?.buyerProfile?.buyerType ?? "importer",
          ),
          purchasingCategories: listField(
            buyer,
            "purchasingCategories",
            existing?.buyerProfile?.purchasingCategories ?? [],
          ),
          preferredSupplierType: textField(
            buyer,
            "preferredSupplierType",
            existing?.buyerProfile?.preferredSupplierType ?? "",
          ),
          targetOrderSize: textField(
            buyer,
            "targetOrderSize",
            existing?.buyerProfile?.targetOrderSize ?? "",
          ),
          monthlyImportVolume: textField(
            buyer,
            "monthlyImportVolume",
            existing?.buyerProfile?.monthlyImportVolume ?? "",
          ),
          importExperience: textField(
            buyer,
            "importExperience",
            existing?.buyerProfile?.importExperience ?? "",
          ),
          purchaseTimeline: textField(
            buyer,
            "purchaseTimeline",
            existing?.buyerProfile?.purchaseTimeline ?? "",
          ),
          salesChannels: listField(
            buyer,
            "salesChannels",
            existing?.buyerProfile?.salesChannels ?? [],
          ),
        },
      });
    }

    if (criticalChanged || (!existing && companyRole === "seller")) {
      await getDb().verificationRequest.create({
        data: {
          companyId: company.id,
          requestedByUserId: user.id,
          status: "pending_review",
        },
      });
    }

    return Response.json(
      await getDb().company.findUnique({
        where: { id: company.id },
        include: {
          sellerProfile: true,
          buyerProfile: true,
          verificationRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              adminNote: true,
              documentFilename: true,
              createdAt: true,
            },
          },
        },
      }),
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
