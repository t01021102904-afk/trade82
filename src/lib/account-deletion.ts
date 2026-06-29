import "server-only";

import {
  DELETED_COMPANY_NAME,
  DELETED_USER_NAME,
} from "@/lib/deletion-markers";
import { getDb } from "@/lib/db";
import {
  deleteStorageFile,
  getPrivateStorageBucket,
  getPublicStorageBucket,
} from "@/lib/supabase-storage";

type CleanupTarget =
  | {
      userProfileId: string;
      clerkUserId?: string;
    }
  | {
      userProfileId?: string;
      clerkUserId: string;
    };

type StorageFileTarget = {
  path: string;
  visibility: "public" | "private";
};

export type AccountDeletionCleanupResult = {
  userProfileId: string | null;
  clerkUserId: string | null;
  companyCount: number;
  productCount: number;
  messageAttachmentCount: number;
  publicStorageDeleteCount: number;
  privateStorageDeleteCount: number;
  failedStorageDeleteCount: number;
};

const PRODUCT_IMAGE_VARIANTS = [
  "original.webp",
  "card-320.webp",
  "main-640.webp",
  "detail-1280.webp",
] as const;

function unique<T>(items: Iterable<T>) {
  return Array.from(new Set(items));
}

function anonymizedEmail(userProfileId: string) {
  return `deleted-${userProfileId}@deleted.trade82.local`;
}

function anonymizedClerkUserId(userProfileId: string) {
  return `deleted:${userProfileId}`;
}

function storagePathFromPublicUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${getPublicStorageBucket()}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function addPublicUrlPath(
  paths: Set<string>,
  value: string | null | undefined,
) {
  const path = storagePathFromPublicUrl(value);
  if (path) paths.add(path);
}

function addProductImageVariantPaths(paths: Set<string>, basePath: string) {
  const normalized = basePath.replace(/\/+$/, "");
  for (const variant of PRODUCT_IMAGE_VARIANTS) {
    paths.add(`${normalized}/${variant}`);
  }
}

async function deleteOwnedStorageFiles(files: StorageFileTarget[]) {
  let publicStorageDeleteCount = 0;
  let privateStorageDeleteCount = 0;
  let failedStorageDeleteCount = 0;

  for (const file of files) {
    try {
      await deleteStorageFile(file.path, file.visibility);
      if (file.visibility === "public") {
        publicStorageDeleteCount += 1;
      } else {
        privateStorageDeleteCount += 1;
      }
    } catch (error) {
      failedStorageDeleteCount += 1;
      console.warn("Account cleanup could not remove a storage object.", {
        visibility: file.visibility,
        bucket:
          file.visibility === "public"
            ? getPublicStorageBucket()
            : getPrivateStorageBucket(),
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  return {
    publicStorageDeleteCount,
    privateStorageDeleteCount,
    failedStorageDeleteCount,
  };
}

export async function cleanupTrade82AccountData(target: CleanupTarget) {
  const db = getDb();
  const profile = await db.userProfile.findFirst({
    where: {
      OR: [
        target.userProfileId ? { id: target.userProfileId } : undefined,
        target.clerkUserId ? { clerkUserId: target.clerkUserId } : undefined,
      ].filter(Boolean) as Array<{ id: string } | { clerkUserId: string }>,
    },
    include: {
      companies: {
        include: {
          products: {
            include: {
              images: true,
            },
          },
          verificationRequests: true,
        },
      },
    },
  });

  if (!profile) {
    return {
      userProfileId: null,
      clerkUserId: target.clerkUserId ?? null,
      companyCount: 0,
      productCount: 0,
      messageAttachmentCount: 0,
      publicStorageDeleteCount: 0,
      privateStorageDeleteCount: 0,
      failedStorageDeleteCount: 0,
    } satisfies AccountDeletionCleanupResult;
  }

  const companyIds = profile.companies.map((company) => company.id);
  const productIds = profile.companies.flatMap((company) =>
    company.products.map((product) => product.id),
  );
  const publicStoragePaths = new Set<string>();
  const privateStoragePaths = new Set<string>();

  addPublicUrlPath(publicStoragePaths, profile.avatarOriginalUrl);
  addPublicUrlPath(publicStoragePaths, profile.avatarUrl);
  for (const company of profile.companies) {
    addPublicUrlPath(publicStoragePaths, company.logoOriginalUrl);
    addPublicUrlPath(publicStoragePaths, company.logoThumbnailUrl);
    addPublicUrlPath(publicStoragePaths, company.logoUrl);
    for (const request of company.verificationRequests) {
      if (request.documentPath) privateStoragePaths.add(request.documentPath);
    }
    for (const product of company.products) {
      addPublicUrlPath(publicStoragePaths, product.imageUrl);
      for (const image of product.images) {
        addPublicUrlPath(publicStoragePaths, image.originalUrl);
        addPublicUrlPath(publicStoragePaths, image.cardUrl);
        addPublicUrlPath(publicStoragePaths, image.mainUrl);
        addPublicUrlPath(publicStoragePaths, image.detailUrl);
        addProductImageVariantPaths(publicStoragePaths, image.storagePath);
      }
    }
  }

  const messageAttachments = await db.messageAttachment.findMany({
    where: {
      OR: [
        { uploadedByUserId: profile.id },
        companyIds.length ? { uploadedByCompanyId: { in: companyIds } } : undefined,
      ].filter(Boolean) as Array<
        | { uploadedByUserId: string }
        | { uploadedByCompanyId: { in: string[] } }
      >,
    },
    select: { id: true, storagePath: true },
  });
  for (const attachment of messageAttachments) {
    privateStoragePaths.add(attachment.storagePath);
  }

  const userCreatedDealContracts = await db.deal.findMany({
    where: {
      createdByUserId: profile.id,
      contractFilePath: { not: null },
    },
    select: { contractFilePath: true },
  });
  for (const deal of userCreatedDealContracts) {
    if (deal.contractFilePath) privateStoragePaths.add(deal.contractFilePath);
  }

  await db.$transaction(async (tx) => {
    if (productIds.length) {
      await tx.inquiry.updateMany({
        where: { productId: { in: productIds } },
        data: { productId: null },
      });
      await tx.deal.updateMany({
        where: { productId: { in: productIds } },
        data: { productId: null },
      });
      await tx.savedItem.deleteMany({
        where: { productId: { in: productIds } },
      });
      await tx.productImage.deleteMany({
        where: { productId: { in: productIds } },
      });
      await tx.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }

    if (companyIds.length) {
      await tx.savedItem.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.review.updateMany({
        where: {
          OR: [
            { reviewerCompanyId: { in: companyIds } },
            { reviewedCompanyId: { in: companyIds } },
          ],
        },
        data: {
          isPublic: false,
          adminApproved: false,
          publicValueDisplay: "hidden",
        },
      });
      await tx.companyReview.updateMany({
        where: {
          OR: [
            { reviewerCompanyId: { in: companyIds } },
            { reviewedCompanyId: { in: companyIds } },
          ],
        },
        data: {
          isPublic: false,
          deletedAt: new Date(),
        },
      });
      await tx.deal.updateMany({
        where: {
          OR: [
            { buyerCompanyId: { in: companyIds } },
            { sellerCompanyId: { in: companyIds } },
          ],
        },
        data: {
          isPublic: false,
          publicValueDisplay: "hidden",
        },
      });
      await tx.sellerProfile.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.buyerProfile.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.verificationRequest.deleteMany({
        where: {
          OR: [
            { companyId: { in: companyIds } },
            { requestedByUserId: profile.id },
          ],
        },
      });
      await tx.company.updateMany({
        where: { id: { in: companyIds } },
        data: {
          legalName: DELETED_COMPANY_NAME,
          tradeName: null,
          logoOriginalUrl: null,
          logoThumbnailUrl: null,
          logoUrl: null,
          useDefaultLogo: true,
          website: "",
          country: "Deleted",
          city: "",
          stateOrProvince: "",
          businessAddress: "Deleted",
          description: "",
          categories: [],
          verificationStatus: "rejected",
        },
      });
    }

    if (messageAttachments.length) {
      await tx.messageAttachment.deleteMany({
        where: { id: { in: messageAttachments.map((attachment) => attachment.id) } },
      });
    }

    await tx.savedItem.deleteMany({
      where: { userId: profile.id },
    });
    await tx.message.updateMany({
      where: { senderUserId: profile.id },
      data: {
        senderCompanyId: null,
      },
    });
    await tx.message.updateMany({
      where: { receiverUserId: profile.id },
      data: {
        receiverUserId: null,
        receiverCompanyId: null,
      },
    });
    if (companyIds.length) {
      await tx.message.updateMany({
        where: { senderCompanyId: { in: companyIds } },
        data: { senderCompanyId: null },
      });
      await tx.message.updateMany({
        where: { receiverCompanyId: { in: companyIds } },
        data: { receiverCompanyId: null },
      });
    }
    await tx.deal.updateMany({
      where: {
        createdByUserId: profile.id,
        contractFilePath: { not: null },
      },
      data: {
        contractFilePath: null,
        contractFileName: null,
      },
    });
    await tx.verificationRequest.updateMany({
      where: { reviewedByUserId: profile.id },
      data: { reviewedByUserId: null },
    });

    await tx.userProfile.update({
      where: { id: profile.id },
      data: {
        clerkUserId: anonymizedClerkUserId(profile.id),
        email: anonymizedEmail(profile.id),
        displayName: DELETED_USER_NAME,
        avatarOriginalUrl: null,
        avatarUrl: null,
        companyAffiliation: "",
        jobTitle: "",
        department: "",
        bio: "",
        phoneNumber: "",
        linkedinUrl: "",
        country: "",
        city: "",
        role: "user",
        preferredLanguage: "en",
      },
    });
  });

  const storageFiles = [
    ...unique(publicStoragePaths).map((path) => ({
      path,
      visibility: "public" as const,
    })),
    ...unique(privateStoragePaths).map((path) => ({
      path,
      visibility: "private" as const,
    })),
  ];
  const storageResult = await deleteOwnedStorageFiles(storageFiles);

  return {
    userProfileId: profile.id,
    clerkUserId: profile.clerkUserId,
    companyCount: companyIds.length,
    productCount: productIds.length,
    messageAttachmentCount: messageAttachments.length,
    ...storageResult,
  } satisfies AccountDeletionCleanupResult;
}
