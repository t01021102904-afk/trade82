import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  rateLimitOrResponse,
  readJsonObject,
  requiredIdField,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { isTrade82TeamAccount } from "@/lib/trade82-team";

export async function GET() {
  try {
    await requireAdmin();

    const companies = await getDb().company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { email: true, displayName: true, role: true } },
        sellerProfile: { select: { id: true } },
        buyerProfile: { select: { id: true } },
        verificationRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            documentFilename: true,
            createdAt: true,
          },
        },
        products: {
          where: { status: { not: "inactive" } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            category: true,
            imageUrl: true,
            updatedAt: true,
            images: {
              orderBy: { position: "asc" },
              take: 1,
              select: { cardUrl: true, mainUrl: true, originalUrl: true },
            },
          },
        },
        _count: {
          select: {
            products: true,
            buyerInquiries: true,
            sellerInquiries: true,
          },
        },
      },
    });

    return Response.json(
      companies.map((company) => ({
        id: company.id,
        legalName: company.legalName,
        tradeName: company.tradeName,
        companyRole: company.companyRole,
        verificationStatus: company.verificationStatus,
        logoOriginalUrl: company.logoOriginalUrl,
        logoThumbnailUrl: company.logoThumbnailUrl,
        logoUrl: company.logoUrl,
        useDefaultLogo: company.useDefaultLogo,
        country: company.country,
        city: company.city,
        stateOrProvince: company.stateOrProvince,
        createdAt: company.createdAt,
        ownerEmail: company.owner.email,
        ownerDisplayName: company.owner.displayName,
        isTrade82Team: isTrade82TeamAccount(company.owner),
        productCount: company.products.length,
        products: company.products.map((product) => ({
          id: product.id,
          name: product.name,
          status: product.status,
          category: product.category,
          imageUrl:
            product.images[0]?.cardUrl ??
            product.images[0]?.mainUrl ??
            product.imageUrl ??
            product.images[0]?.originalUrl ??
            null,
          updatedAt: product.updatedAt,
        })),
        inquiryCount:
          company.companyRole === "seller"
            ? company._count.sellerInquiries
            : company._count.buyerInquiries,
        latestRequest: company.verificationRequests[0] ?? null,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-companies-write",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = await readJsonObject(request);
    const companyId = requiredIdField(body, "companyId");
    const action = enumField(body, "action", [
      "approve",
      "reject",
      "pause",
      "request_updates",
      "reset",
      "delete_product",
    ]);

    if (action === "delete_product") {
      const productId = requiredIdField(body, "productId");
      const product = await getDb().product.findFirst({
        where: { id: productId, sellerCompanyId: companyId },
        select: { id: true },
      });
      if (!product) {
        return Response.json({ error: "Product not found." }, { status: 404 });
      }
      await getDb().product.update({
        where: { id: productId },
        data: { status: "inactive" },
      });
      return Response.json({ ok: true, productId, productStatus: "inactive" });
    }

    const statusMap: Record<string, string> = {
      approve: "verified",
      reject: "rejected",
      pause: "needs_reverification",
      request_updates: "needs_reverification",
      reset: "pending_review",
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return Response.json({ error: "Invalid action." }, { status: 400 });
    }

    const company = await getDb().company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return Response.json({ error: "Company not found." }, { status: 404 });
    }

    if (action === "approve" || action === "reject") {
      const requestStatus = action === "approve" ? "verified" : "rejected";
      await getDb().$transaction([
        getDb().company.update({
          where: { id: companyId },
          data: { verificationStatus: newStatus as never },
        }),
        getDb().verificationRequest.updateMany({
          where: { companyId, status: "pending_review" },
          data: { status: requestStatus },
        }),
      ]);
    } else {
      await getDb().company.update({
        where: { id: companyId },
        data: { verificationStatus: newStatus as never },
      });
    }

    return Response.json({ ok: true, verificationStatus: newStatus });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
