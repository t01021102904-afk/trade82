import "server-only";

import {
  HomepagePromotionMediaType,
  Prisma,
} from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HOMEPAGE_PROMOTION_MAX_ITEMS } from "@/lib/homepage-promotion-constants";
import type { Locale } from "@/lib/i18n";

const managementLockKey = "trade82-homepage-promotions-management";

const adminSelect = {
  id: true,
  adminTitle: true,
  altTextEn: true,
  altTextKo: true,
  mediaType: true,
  thumbnailUrl: true,
  thumbnailStoragePath: true,
  pdfUrl: true,
  pdfStoragePath: true,
  destinationUrl: true,
  openInNewTab: true,
  displayOrder: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  pendingStorageCleanupPaths: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.HomepagePromotionSelect;

export type CreateHomepagePromotionData = {
  id: string;
  adminTitle: string;
  altTextEn: string;
  altTextKo: string;
  mediaType: HomepagePromotionMediaType;
  thumbnailUrl: string;
  thumbnailStoragePath: string;
  pdfUrl: string | null;
  pdfStoragePath: string | null;
  destinationUrl: string | null;
  openInNewTab: boolean;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdByUserId: string;
};

export async function listAdminHomepagePromotions() {
  return getDb().homepagePromotion.findMany({
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
}

export async function createHomepagePromotion(
  data: CreateHomepagePromotionData,
) {
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${managementLockKey}, 0))`;
    const count = await tx.homepagePromotion.count({
      where: { deletedAt: null },
    });
    if (count >= HOMEPAGE_PROMOTION_MAX_ITEMS) {
      throw new Response("A maximum of 10 promotions is allowed.", {
        status: 409,
      });
    }
    const last = await tx.homepagePromotion.findFirst({
      where: { deletedAt: null },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    return tx.homepagePromotion.create({
      data: {
        ...data,
        displayOrder: (last?.displayOrder ?? -1) + 1,
      },
      select: adminSelect,
    });
  });
}

export async function reorderHomepagePromotions(ids: string[]) {
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${managementLockKey}, 0))`;
    const existing = await tx.homepagePromotion.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (
      existing.length !== ids.length ||
      new Set(ids).size !== ids.length ||
      existing.some((promotion) => !ids.includes(promotion.id))
    ) {
      throw new Response("Promotion order is stale.", { status: 409 });
    }
    await Promise.all(
      ids.map((id, displayOrder) =>
        tx.homepagePromotion.update({
          where: { id },
          data: { displayOrder },
        }),
      ),
    );
    return tx.homepagePromotion.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: "asc" },
      select: adminSelect,
    });
  });
}

export async function softDeleteHomepagePromotion(id: string) {
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${managementLockKey}, 0))`;
    const deleted = await tx.homepagePromotion.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    const remaining = await tx.homepagePromotion.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map((promotion, displayOrder) =>
        tx.homepagePromotion.update({
          where: { id: promotion.id },
          data: { displayOrder },
        }),
      ),
    );
    return deleted;
  });
}

export async function listPublicHomepagePromotions(
  locale: Locale,
  now = new Date(),
) {
  const rows = await getDb().homepagePromotion.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      thumbnailUrl: { not: "" },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    take: HOMEPAGE_PROMOTION_MAX_ITEMS,
    select: {
      id: true,
      altTextEn: true,
      altTextKo: true,
      mediaType: true,
      thumbnailUrl: true,
      destinationUrl: true,
      openInNewTab: true,
      displayOrder: true,
    },
  });

  return rows.map(({ altTextEn, altTextKo, ...row }) => ({
    ...row,
    altText:
      locale === "ko"
        ? altTextKo || altTextEn
        : altTextEn || altTextKo,
  }));
}
