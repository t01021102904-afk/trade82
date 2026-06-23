import { apiError } from "@/lib/api-response";
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

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
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
    const body = (await request.json()) as Record<string, unknown>;
    const companyRole: CompanyRole =
      body.companyRole === "seller" ? "seller" : "buyer";
    const { user } =
      companyRole === "seller" ? await requireSeller() : await requireBuyer();
    const existing = await getDb().company.findUnique({
      where: {
        ownerUserId_companyRole: {
          ownerUserId: user.id,
          companyRole,
        },
      },
      include: { sellerProfile: true },
    });
    const seller = (body.sellerProfile ?? {}) as Record<string, unknown>;
    const criticalChanged =
      existing?.verificationStatus === "verified" &&
      (criticalCompanyFields.some(
        (field) => String(body[field] ?? "") !== String(existing[field] ?? ""),
      ) ||
        (companyRole === "seller" &&
          (String(seller.koreanBusinessRegistrationNumber ?? "") !==
            String(
              existing.sellerProfile?.koreanBusinessRegistrationNumber ?? "",
            ) ||
            String(seller.representativeName ?? "") !==
              String(existing.sellerProfile?.representativeName ?? ""))));
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
        legalName: String(body.legalName ?? ""),
        tradeName: String(body.tradeName ?? "") || null,
        logoOriginalUrl: String(body.logoOriginalUrl ?? "") || null,
        logoThumbnailUrl: String(body.logoThumbnailUrl ?? "") || null,
        logoUrl: String(body.logoUrl ?? "") || null,
        useDefaultLogo: body.useDefaultLogo !== false,
        website: String(body.website ?? ""),
        country: String(
          body.country ?? (companyRole === "seller" ? "South Korea" : "United States"),
        ),
        city: String(body.city ?? ""),
        stateOrProvince: String(body.stateOrProvince ?? ""),
        businessAddress: String(body.businessAddress ?? ""),
        description: String(body.description ?? ""),
        categories: strings(body.categories),
        verificationStatus,
      },
      update: {
        legalName: String(body.legalName ?? ""),
        tradeName: String(body.tradeName ?? "") || null,
        logoOriginalUrl: String(body.logoOriginalUrl ?? "") || null,
        logoThumbnailUrl: String(body.logoThumbnailUrl ?? "") || null,
        logoUrl: String(body.logoUrl ?? "") || null,
        useDefaultLogo: body.useDefaultLogo !== false,
        website: String(body.website ?? ""),
        country: String(body.country ?? ""),
        city: String(body.city ?? ""),
        stateOrProvince: String(body.stateOrProvince ?? ""),
        businessAddress: String(body.businessAddress ?? ""),
        description: String(body.description ?? ""),
        categories: strings(body.categories),
        verificationStatus,
      },
    });

    if (companyRole === "seller") {
      await getDb().sellerProfile.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          koreanBusinessRegistrationNumber: String(
            seller.koreanBusinessRegistrationNumber ?? "",
          ),
          representativeName: String(seller.representativeName ?? ""),
          exportExperience: String(seller.exportExperience ?? ""),
          exportCountries: strings(seller.exportCountries),
          productCategories: strings(seller.productCategories),
          minimumOrderQuantity: String(seller.minimumOrderQuantity ?? ""),
          leadTime: String(seller.leadTime ?? ""),
          certifications: strings(seller.certifications),
          shippingTerms: strings(seller.shippingTerms),
          paymentTerms: strings(seller.paymentTerms),
          factoryOrDistributorStatus: String(
            seller.factoryOrDistributorStatus ?? "factory",
          ),
        },
        update: {
          koreanBusinessRegistrationNumber: String(
            seller.koreanBusinessRegistrationNumber ?? "",
          ),
          representativeName: String(seller.representativeName ?? ""),
          exportExperience: String(seller.exportExperience ?? ""),
          exportCountries: strings(seller.exportCountries),
          productCategories: strings(seller.productCategories),
          minimumOrderQuantity: String(seller.minimumOrderQuantity ?? ""),
          leadTime: String(seller.leadTime ?? ""),
          certifications: strings(seller.certifications),
          shippingTerms: strings(seller.shippingTerms),
          paymentTerms: strings(seller.paymentTerms),
          factoryOrDistributorStatus: String(
            seller.factoryOrDistributorStatus ?? "factory",
          ),
        },
      });
    } else {
      const buyer = (body.buyerProfile ?? {}) as Record<string, unknown>;
      await getDb().buyerProfile.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          buyerType: String(buyer.buyerType ?? "importer"),
          purchasingCategories: strings(buyer.purchasingCategories),
          targetOrderSize: String(buyer.targetOrderSize ?? ""),
          monthlyImportVolume: String(buyer.monthlyImportVolume ?? ""),
          importExperience: String(buyer.importExperience ?? ""),
          purchaseTimeline: String(buyer.purchaseTimeline ?? ""),
          salesChannels: strings(buyer.salesChannels),
        },
        update: {
          buyerType: String(buyer.buyerType ?? "importer"),
          purchasingCategories: strings(buyer.purchasingCategories),
          targetOrderSize: String(buyer.targetOrderSize ?? ""),
          monthlyImportVolume: String(buyer.monthlyImportVolume ?? ""),
          importExperience: String(buyer.importExperience ?? ""),
          purchaseTimeline: String(buyer.purchaseTimeline ?? ""),
          salesChannels: strings(buyer.salesChannels),
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
    return apiError(error);
  }
}
