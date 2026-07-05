import { apiError } from "@/lib/api-response";
import { getUserCompany, requireAuth } from "@/lib/authz";
import { buyerCategoryLabel } from "@/lib/company-select-options";
import { getDb } from "@/lib/db";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim();
}

function parseInterestedKeywords(value: string | null | undefined) {
  return (value ?? "")
    .replace(/^interested keywords:\s*/i, "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function productImageUrl(product: {
  imageUrl: string | null;
  images: Array<{ cardUrl: string; mainUrl: string; originalUrl: string }>;
}) {
  const firstImage = product.images[0];
  return firstImage?.cardUrl || firstImage?.mainUrl || product.imageUrl || firstImage?.originalUrl || null;
}

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
        deals,
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
          include: {
            buyerCompany: true,
            product: true,
            sender: { select: { avatarUrl: true } },
          },
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
        getDb().deal.findMany({
          where: { sellerCompanyId: company.id },
          select: {
            dealStatus: true,
            reviews: {
              where: { reviewerCompanyId: company.id },
              select: { id: true },
            },
          },
        }),
      ]);
      const reviewCount = companyReviewStats._count + dealReviewStats._count;
      const ratingTotal =
        (companyReviewStats._avg.rating ?? 0) * companyReviewStats._count +
        (dealReviewStats._avg.rating ?? 0) * dealReviewStats._count;
      const completedDeals = deals.filter(
        (deal) => deal.dealStatus === "completed",
      );
      return Response.json({
        company: {
          id: company.id,
          name: company.tradeName || company.legalName,
          verificationStatus: company.verificationStatus,
          sellerSupportPlan: company.sellerSupportPlan,
          sellerSupportStatus: company.sellerSupportStatus,
          sellerSupportCurrentPeriodEnd: company.sellerSupportCurrentPeriodEnd,
          sellerSupportMonthlyLimit: company.sellerSupportMonthlyLimit,
          sellerSupportMonthlyUsed: company.sellerSupportMonthlyUsed,
        },
        metrics: {
          productViews: products.reduce((sum, item) => sum + item.viewCount, 0),
          companyViews: company.viewCount,
          followers: companySavedCount,
          savedCount: companySavedCount + productSavedCount,
          inquiryCount,
          receivedInquiries: inquiryCount,
          completedDeals: completedDeals.length,
          reviewRequests: completedDeals.filter(
            (deal) => deal.reviews.length === 0,
          ).length,
          reviewCount,
          averageRating: reviewCount ? ratingTotal / reviewCount : 0,
          productCount: products.length,
          listedProductCount: products.filter((item) => item.status === "active")
            .length,
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
          companyLogoThumbnailUrl: item.buyerCompany.logoThumbnailUrl,
          companyLogoUrl: item.buyerCompany.logoUrl,
          useDefaultLogo: item.buyerCompany.useDefaultLogo,
          senderAvatarUrl: item.sender.avatarUrl,
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
      products,
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
        include: {
          sellerCompany: true,
          product: true,
          sender: { select: { avatarUrl: true } },
        },
      }),
      getDb().inquiry.count({ where: { buyerCompanyId: company.id } }),
      getDb().deal.findMany({
        where: { buyerCompanyId: company.id },
        include: { reviews: { where: { reviewerCompanyId: company.id } } },
      }),
      getDb().product.findMany({
        where: {
          status: "active",
          sellerCompany: {
            companyRole: "seller",
            verificationStatus: "verified",
            legalName: { not: DELETED_COMPANY_NAME },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 32,
        include: {
          sellerCompany: {
            select: {
              id: true,
              legalName: true,
              tradeName: true,
            },
          },
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: {
              cardUrl: true,
              mainUrl: true,
              originalUrl: true,
            },
          },
        },
      }),
    ]);
    const buyerCategories = Array.from(
      new Set([
        ...company.categories,
        ...(company.buyerProfile?.purchasingCategories ?? []),
      ].filter(Boolean)),
    );
    const categoryTerms = buyerCategories.flatMap((category) => [
      normalizeText(category),
      normalizeText(buyerCategoryLabel(category, "en")),
    ]);
    const interestedKeywords = parseInterestedKeywords(company.description);
    const normalizedKeywords = interestedKeywords.map(normalizeText);
    const scoredProducts = products
      .map((product) => {
        const haystack = normalizeText(
          [
            product.name,
            product.category,
            product.shortDescription,
            product.detailedDescription,
            ...product.tags,
          ].join(" "),
        );
        const categoryScore = categoryTerms.some((term) => term && haystack.includes(term))
          ? 4
          : 0;
        const keywordScore = normalizedKeywords.reduce(
          (score, keyword) => score + (keyword && haystack.includes(keyword) ? 2 : 0),
          0,
        );
        return { product, score: categoryScore + keywordScore };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ product }) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        imageUrl: productImageUrl(product),
        href: `/products/${product.id}`,
        sellerName: product.sellerCompany.tradeName || product.sellerCompany.legalName,
        priceMin: product.priceMin?.toString() ?? null,
        priceMax: product.priceMax?.toString() ?? null,
        currency: product.currency,
        moq: product.moq,
        tags: product.tags.slice(0, 4),
      }));
    return Response.json({
      company: {
        id: company.id,
        name: company.tradeName || company.legalName,
        verificationStatus: company.verificationStatus,
        categories: buyerCategories,
        buyerProfile: company.buyerProfile,
      },
      buyerProfile: {
        displayName: user.displayName,
        companyName: company.tradeName || company.legalName,
        categories: buyerCategories,
        keywords: interestedKeywords,
        signUpPath: company.buyerProfile?.buyerType ?? "",
        profileCompletion: Math.round(
          ([
            user.displayName,
            user.email,
            company.tradeName || company.legalName,
            buyerCategories.length ? "categories" : "",
            interestedKeywords.length ? "keywords" : "",
          ].filter(Boolean).length /
            5) *
            100,
        ),
      },
      suggestedCategories: buyerCategories.length
        ? buyerCategories
        : [
            "beauty_personal_care",
            "food_snacks",
            "health_wellness",
            "household_goods",
            "electronics_accessories",
          ],
      recommendedProducts: scoredProducts,
      metrics: {
        savedProducts: savedProductCount,
        savedCompanies: savedCompanyCount,
        inquiryCount,
        sentInquiries: inquiryCount,
        completedDeals: deals.filter((deal) => deal.dealStatus === "completed")
          .length,
        reviewRequests: deals.filter(
          (deal) =>
            deal.dealStatus === "completed" && deal.reviews.length === 0,
        ).length,
        reviewedDeals: deals.filter((deal) => deal.reviews.length > 0).length,
      },
      recentSavedItems: savedItems,
      recentInquiries: inquiries.map((item) => ({
        id: item.id,
        message: item.message,
        updatedAt: item.updatedAt,
        companyName:
          item.sellerCompany.tradeName || item.sellerCompany.legalName,
        companyLogoThumbnailUrl: item.sellerCompany.logoThumbnailUrl,
        companyLogoUrl: item.sellerCompany.logoUrl,
        useDefaultLogo: item.sellerCompany.useDefaultLogo,
        senderAvatarUrl: item.sender.avatarUrl,
        productName: item.product?.name || null,
      })),
      recentReviews: [],
    });
  } catch (error) {
    return apiError(error);
  }
}
