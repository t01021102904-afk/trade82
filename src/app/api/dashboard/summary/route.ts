import { apiError } from "@/lib/api-response";
import { getUserCompany, requireAuth } from "@/lib/authz";
import { buyerCategoryLabel } from "@/lib/company-select-options";
import { getDb } from "@/lib/db";
import { DELETED_COMPANY_NAME } from "@/lib/deletion-markers";
import {
  buildSellerDashboardCurrencySeries,
  SELLER_DASHBOARD_HISTORY_DAYS,
} from "@/lib/seller-dashboard-net-sales";
import { getSupplierApplicationCapabilities } from "@/lib/supplier-application";

const noStoreHeaders = { "Cache-Control": "no-store" };

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
    if (role === "seller") {
      const access = await getSupplierApplicationCapabilities(user.id);
      if (!access.canCreateProductCandidate) {
        return Response.json(
          { error: "Supplier approval is required to access the seller dashboard." },
          { status: 403, headers: noStoreHeaders },
        );
      }
    }
    const company = await getUserCompany(user.id, role);
    if (!company) {
      return Response.json(
        { company: null, metrics: {}, recentReviews: [] },
        { headers: noStoreHeaders },
      );
    }

    if (role === "seller") {
      // Dashboard accounting buckets are deliberately UTC. There is no seller
      // timezone on the Company model, so this avoids server-local-date drift.
      const now = new Date();
      const sellerDashboardStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      sellerDashboardStart.setUTCDate(
        sellerDashboardStart.getUTCDate() - (SELLER_DASHBOARD_HISTORY_DAYS - 1),
      );
      const [
        products,
        inquiries,
        inquiryCount,
        newLeadCount,
        quotesInProgressCount,
        paidOrderCount,
        companyReviews,
        dealReviews,
        deals,
        paidSales,
        successfulRefunds,
        newLeads,
        quotesInProgress,
      ] = await Promise.all([
        getDb().product.findMany({
          where: { sellerCompanyId: company.id, deletedAt: null },
          select: { id: true, viewCount: true, status: true },
        }),
        getDb().inquiry.findMany({
          where: {
            sellerCompanyId: company.id,
            buyerCompany: { deletedAt: null },
            product: { deletedAt: null },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            buyerCompany: true,
            product: true,
            sender: { select: { avatarUrl: true } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true },
            },
          },
        }),
        getDb().inquiry.count({
          where: {
            sellerCompanyId: company.id,
            buyerCompany: { deletedAt: null },
            product: { deletedAt: null },
          },
        }),
        getDb().inquiry.count({
          where: {
            sellerCompanyId: company.id,
            status: "sent",
            buyerCompany: { deletedAt: null },
            product: { deletedAt: null },
          },
        }),
        getDb().rfqSellerQuote.count({
          where: {
            sellerCompanyId: company.id,
            status: { in: ["REQUESTED", "SUBMITTED", "NEGOTIATING"] },
          },
        }),
        getDb().tradeOrder.count({
          where: {
            sellerCompanyId: company.id,
            paymentStatus: "PAID",
          },
        }),
        getDb().companyReview.findMany({
          where: {
            reviewedCompanyId: company.id,
            isPublic: true,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, comment: true, createdAt: true },
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
            reviewText: true,
            createdAt: true,
          },
        }),
        getDb().deal.findMany({
          where: {
            sellerCompanyId: company.id,
            buyerCompany: { deletedAt: null },
          },
          select: {
            dealStatus: true,
            reviews: {
              where: { reviewerCompanyId: company.id },
              select: { id: true },
            },
          },
        }),
        // TradeOrder is one-to-one with PaymentRequest, so each confirmed
        // payment is represented once. Refunded orders remain here to retain
        // their original paid event; the successful refund is recorded below
        // on its own actual event date.
        getDb().tradeOrder.findMany({
          where: {
            sellerCompanyId: company.id,
            paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
            orderStatus: { not: "CANCELLED" },
            paidAt: { gte: sellerDashboardStart, lte: now },
          },
          select: {
            paidAt: true,
            grossAmount: true,
            currency: true,
          },
        }),
        // PaymentRefund has one row per unique Stripe refund ID. Only the
        // terminal Stripe status is a financial event, and the relation keeps
        // the query scoped to this authenticated seller's company.
        getDb().paymentRefund.findMany({
          where: {
            status: "succeeded",
            lastStripeEventCreatedAt: { gte: sellerDashboardStart, lte: now },
            paymentRequest: {
              sellerCompanyId: company.id,
              tradeOrderByPaymentRequest: { is: { orderStatus: { not: "CANCELLED" } } },
            },
          },
          select: {
            amount: true,
            lastStripeEventCreatedAt: true,
            paymentRequest: { select: { currency: true } },
          },
        }),
        getDb().inquiry.findMany({
          where: {
            sellerCompanyId: company.id,
            status: "sent",
            createdAt: { gte: sellerDashboardStart, lte: now },
            buyerCompany: { deletedAt: null },
            product: { deletedAt: null },
          },
          select: { createdAt: true },
        }),
        getDb().rfqSellerQuote.findMany({
          where: {
            sellerCompanyId: company.id,
            status: { in: ["REQUESTED", "SUBMITTED", "NEGOTIATING"] },
            createdAt: { gte: sellerDashboardStart, lte: now },
          },
          select: { createdAt: true },
        }),
      ]);
      const completedDeals = deals.filter(
        (deal) => deal.dealStatus === "completed",
      );
      const sellerDashboard = buildSellerDashboardCurrencySeries({
        now,
        payments: paidSales.flatMap((order) =>
          order.paidAt
            ? [{
                occurredAt: order.paidAt,
                currency: order.currency,
                minorUnits: order.grossAmount,
              }]
            : [],
        ),
        refunds: successfulRefunds.map((refund) => ({
          occurredAt: refund.lastStripeEventCreatedAt,
          currency: refund.paymentRequest.currency,
          minorUnits: refund.amount,
        })),
        newLeads: newLeads.map((lead) => ({ occurredAt: lead.createdAt })),
        quotesInProgress: quotesInProgress.map((quote) => ({ occurredAt: quote.createdAt })),
      });
      return Response.json({
        company: {
          id: company.id,
          name: company.tradeName || company.legalName,
          verificationStatus: company.verificationStatus,
        },
        metrics: {
          productViews: products.reduce((sum, item) => sum + item.viewCount, 0),
          companyViews: company.viewCount,
          inquiryCount,
          receivedInquiries: inquiryCount,
          newLeads: newLeadCount,
          quotesInProgress: quotesInProgressCount,
          paidOrders: paidOrderCount,
          completedDeals: completedDeals.length,
          reviewRequests: completedDeals.filter(
            (deal) => deal.reviews.length === 0,
          ).length,
          productCount: products.length,
          listedProductCount: products.filter((item) => item.status === "active")
            .length,
        },
        sellerDashboard: {
          // Currency values stay separated—there is no exchange-rate snapshot
          // in the product, so no cross-currency conversion is attempted.
          defaultCurrency:
            sellerDashboard.currencySeries.find((series) => series.currency === "USD")?.currency
            ?? sellerDashboard.currencySeries[0]?.currency
            ?? null,
          currencySeries: sellerDashboard.currencySeries,
          activitySeries: sellerDashboard.activitySeries,
        },
        recentReviews: [
          ...companyReviews.map((item) => ({
            id: item.id,
            text: item.comment,
            createdAt: item.createdAt,
          })),
          ...dealReviews.map((item) => ({
            id: item.id,
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
          lastMessage: item.messages[0]?.body || item.message,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          companyName:
            item.buyerCompany.tradeName || item.buyerCompany.legalName,
          country: item.buyerCompany.country,
          companyLogoThumbnailUrl: item.buyerCompany.logoThumbnailUrl,
          companyLogoUrl: item.buyerCompany.logoUrl,
          useDefaultLogo: item.buyerCompany.useDefaultLogo,
          senderAvatarUrl: item.sender.avatarUrl,
          productName: item.product?.name || null,
        })),
      }, { headers: noStoreHeaders });
    }

    const [
      savedItems,
      savedProductCount,
      inquiries,
      inquiryCount,
      deals,
      products,
    ] = await Promise.all([
      getDb().savedItem.findMany({
        where: {
          userId: user.id,
          type: "product",
          product: { deletedAt: null, sellerCompany: { deletedAt: null } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      getDb().savedItem.count({
        where: {
          userId: user.id,
          type: "product",
          product: { deletedAt: null, sellerCompany: { deletedAt: null } },
        },
      }),
      getDb().inquiry.findMany({
        where: {
          buyerCompanyId: company.id,
          sellerCompany: { deletedAt: null },
          product: { deletedAt: null },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: {
          sellerCompany: true,
          product: true,
          sender: { select: { avatarUrl: true } },
        },
      }),
      getDb().inquiry.count({
        where: {
          buyerCompanyId: company.id,
          sellerCompany: { deletedAt: null },
          product: { deletedAt: null },
        },
      }),
      getDb().deal.findMany({
        where: {
          buyerCompanyId: company.id,
          sellerCompany: { deletedAt: null },
          product: { deletedAt: null },
        },
        include: { reviews: { where: { reviewerCompanyId: company.id } } },
      }),
      getDb().product.findMany({
        where: {
          status: "active",
          deletedAt: null,
          sellerCompany: {
            companyRole: "seller",
            verificationStatus: "verified",
            deletedAt: null,
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
    }, { headers: noStoreHeaders });
  } catch (error) {
    return apiError(error);
  }
}
