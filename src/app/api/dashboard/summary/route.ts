import { apiError } from "@/lib/api-response";
import { getUserCompany, requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const role = url.searchParams.get("role") === "seller" ? "seller" : "buyer";
    const company = await getUserCompany(user.id, role);
    if (!company) {
      return Response.json({ company: null, metrics: {}, recentReviews: [] });
    }

    if (role === "seller") {
      const [
        products,
        companySavedCount,
        productSavedCount,
        inquiries,
        inquiryCount,
        companyReviews,
        dealReviews,
        companyReviewStats,
        dealReviewStats,
      ] = await Promise.all([
        getDb().product.findMany({
          where: { sellerCompanyId: company.id },
          select: { id: true, viewCount: true, status: true },
        }),
        getDb().savedItem.count({ where: { companyId: company.id } }),
        getDb().savedItem.count({
          where: { product: { sellerCompanyId: company.id } },
        }),
        getDb().inquiry.findMany({
          where: { sellerCompanyId: company.id },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { buyerCompany: true, product: true },
        }),
        getDb().inquiry.count({ where: { sellerCompanyId: company.id } }),
        getDb().companyReview.findMany({
          where: {
            reviewedCompanyId: company.id,
            isPublic: true,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, rating: true, comment: true, createdAt: true },
        }),
        getDb().review.findMany({
          where: {
            reviewedCompanyId: company.id,
            isPublic: true,
            adminApproved: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            rating: true,
            reviewText: true,
            createdAt: true,
          },
        }),
        getDb().companyReview.aggregate({
          where: {
            reviewedCompanyId: company.id,
            isPublic: true,
            deletedAt: null,
          },
          _count: true,
          _avg: { rating: true },
        }),
        getDb().review.aggregate({
          where: {
            reviewedCompanyId: company.id,
            isPublic: true,
            adminApproved: true,
          },
          _count: true,
          _avg: { rating: true },
        }),
      ]);
      const reviewCount = companyReviewStats._count + dealReviewStats._count;
      const ratingTotal =
        (companyReviewStats._avg.rating ?? 0) * companyReviewStats._count +
        (dealReviewStats._avg.rating ?? 0) * dealReviewStats._count;
      return Response.json({
        company: {
          id: company.id,
          name: company.tradeName || company.legalName,
          verificationStatus: company.verificationStatus,
        },
        metrics: {
          productViews: products.reduce((sum, item) => sum + item.viewCount, 0),
          companyViews: company.viewCount,
          savedCount: companySavedCount + productSavedCount,
          inquiryCount,
          reviewCount,
          averageRating: reviewCount ? ratingTotal / reviewCount : 0,
          productCount: products.length,
        },
        recentReviews: [
          ...companyReviews.map((item) => ({
            id: item.id,
            rating: item.rating,
            text: item.comment,
            createdAt: item.createdAt,
          })),
          ...dealReviews.map((item) => ({
            id: item.id,
            rating: item.rating,
            text: item.reviewText,
            createdAt: item.createdAt,
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5),
        recentInquiries: inquiries.map((item) => ({
          id: item.id,
          message: item.message,
          updatedAt: item.updatedAt,
          companyName:
            item.buyerCompany.tradeName || item.buyerCompany.legalName,
          productName: item.product?.name || null,
        })),
      });
    }

    const [
      savedItems,
      savedProductCount,
      savedCompanyCount,
      inquiries,
      inquiryCount,
      deals,
    ] = await Promise.all([
      getDb().savedItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      getDb().savedItem.count({
        where: { userId: user.id, type: "product" },
      }),
      getDb().savedItem.count({
        where: { userId: user.id, type: "company" },
      }),
      getDb().inquiry.findMany({
        where: { buyerCompanyId: company.id },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { sellerCompany: true, product: true },
      }),
      getDb().inquiry.count({ where: { buyerCompanyId: company.id } }),
      getDb().deal.findMany({
        where: { buyerCompanyId: company.id },
        include: { reviews: { where: { reviewerCompanyId: company.id } } },
      }),
    ]);
    return Response.json({
      company: {
        id: company.id,
        name: company.tradeName || company.legalName,
        verificationStatus: company.verificationStatus,
      },
      metrics: {
        savedProducts: savedProductCount,
        savedCompanies: savedCompanyCount,
        inquiryCount,
        reviewedDeals: deals.filter((deal) => deal.reviews.length > 0).length,
      },
      recentSavedItems: savedItems,
      recentInquiries: inquiries.map((item) => ({
        id: item.id,
        message: item.message,
        updatedAt: item.updatedAt,
        companyName:
          item.sellerCompany.tradeName || item.sellerCompany.legalName,
        productName: item.product?.name || null,
      })),
      recentReviews: [],
    });
  } catch (error) {
    return apiError(error);
  }
}
