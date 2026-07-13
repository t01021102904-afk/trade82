import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  deleteStorageFile,
  getPublicStorageBucket,
} from "@/lib/supabase-storage";

type StorageFileTarget = {
  path: string;
  visibility: "public" | "private";
};

type ProductForStorage = {
  imageUrl: string | null;
  images: Array<{
    originalUrl: string;
    cardUrl: string;
    mainUrl: string;
    detailUrl: string;
    storagePath: string;
  }>;
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

function addProductStoragePaths(paths: Set<string>, product: ProductForStorage) {
  addPublicUrlPath(paths, product.imageUrl);
  for (const image of product.images) {
    addPublicUrlPath(paths, image.originalUrl);
    addPublicUrlPath(paths, image.cardUrl);
    addPublicUrlPath(paths, image.mainUrl);
    addPublicUrlPath(paths, image.detailUrl);
    addProductImageVariantPaths(paths, image.storagePath);
  }
}

async function deleteStorageFiles(files: StorageFileTarget[]) {
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
      console.warn("Admin hard delete could not remove a storage object.", {
        visibility: file.visibility,
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

export async function hardDeleteProductForAdmin(
  productId: string,
  expectedCompanyId?: string,
) {
  const db = getDb();
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { images: true },
  });
  if (!product) return null;
  if (expectedCompanyId && product.sellerCompanyId !== expectedCompanyId) {
    return null;
  }

  const publicStoragePaths = new Set<string>();
  addProductStoragePaths(publicStoragePaths, product);

  await db.$transaction(async (tx) => {
    await tx.inquiry.updateMany({
      where: { productId },
      data: { productId: null },
    });
    await tx.deal.updateMany({
      where: { productId },
      data: { productId: null },
    });
    await tx.savedItem.deleteMany({ where: { productId } });
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
  });

  const storageResult = await deleteStorageFiles(
    unique(publicStoragePaths).map((path) => ({
      path,
      visibility: "public" as const,
    })),
  );

  return {
    productId,
    ...storageResult,
  };
}

export async function hardDeleteCompanyForAdmin(companyId: string) {
  const db = getDb();
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      products: { include: { images: true } },
      verificationRequests: true,
    },
  });
  if (!company) return null;

  const publicStoragePaths = new Set<string>();
  const privateStoragePaths = new Set<string>();

  addPublicUrlPath(publicStoragePaths, company.logoOriginalUrl);
  addPublicUrlPath(publicStoragePaths, company.logoThumbnailUrl);
  addPublicUrlPath(publicStoragePaths, company.logoUrl);
  for (const product of company.products) {
    addProductStoragePaths(publicStoragePaths, product);
  }
  for (const request of company.verificationRequests) {
    if (request.documentPath) privateStoragePaths.add(request.documentPath);
  }

  const inquiryWhere: Prisma.InquiryWhereInput = {
    OR: [
      { buyerCompanyId: companyId },
      { sellerCompanyId: companyId },
      { recipientCompanyId: companyId },
    ],
  };
  const inquiries = await db.inquiry.findMany({
    where: inquiryWhere,
    select: { id: true },
  });
  const inquiryIds = inquiries.map((inquiry) => inquiry.id);

  const dealOr: Prisma.DealWhereInput[] = [
    { buyerCompanyId: companyId },
    { sellerCompanyId: companyId },
  ];
  if (inquiryIds.length) dealOr.push({ inquiryId: { in: inquiryIds } });
  const deals = await db.deal.findMany({
    where: { OR: dealOr },
    select: { id: true, contractFilePath: true },
  });
  const dealIds = deals.map((deal) => deal.id);
  for (const deal of deals) {
    if (deal.contractFilePath) privateStoragePaths.add(deal.contractFilePath);
  }

  const attachmentOr: Prisma.MessageAttachmentWhereInput[] = [
    { uploadedByCompanyId: companyId },
  ];
  if (inquiryIds.length) attachmentOr.push({ inquiryId: { in: inquiryIds } });
  const attachments = await db.messageAttachment.findMany({
    where: { OR: attachmentOr },
    select: { id: true, storagePath: true },
  });
  for (const attachment of attachments) {
    privateStoragePaths.add(attachment.storagePath);
  }

  const productIds = company.products.map((product) => product.id);
  const attachmentIds = attachments.map((attachment) => attachment.id);

  if (inquiryIds.length) {
    const paymentRequestCount = await db.paymentRequest.count({
      where: { inquiryId: { in: inquiryIds } },
    });
    if (paymentRequestCount > 0) {
      throw new Error(
        "Companies with payment history cannot be permanently deleted. Retain the record for financial reconciliation.",
      );
    }
  }

  await db.$transaction(async (tx) => {
    if (attachmentIds.length) {
      await tx.messageAttachment.deleteMany({
        where: { id: { in: attachmentIds } },
      });
    }

    const messageOr: Prisma.MessageWhereInput[] = [
      { senderCompanyId: companyId },
      { receiverCompanyId: companyId },
    ];
    if (inquiryIds.length) messageOr.push({ inquiryId: { in: inquiryIds } });
    await tx.message.deleteMany({ where: { OR: messageOr } });

    await tx.review.deleteMany({
      where: {
        OR: [
          { reviewerCompanyId: companyId },
          { reviewedCompanyId: companyId },
          ...(dealIds.length ? [{ dealId: { in: dealIds } }] : []),
        ],
      },
    });
    await tx.companyReview.deleteMany({
      where: {
        OR: [
          { reviewerCompanyId: companyId },
          { reviewedCompanyId: companyId },
        ],
      },
    });

    if (dealIds.length) {
      await tx.deal.deleteMany({ where: { id: { in: dealIds } } });
    }
    if (inquiryIds.length) {
      await tx.inquiry.deleteMany({ where: { id: { in: inquiryIds } } });
    }

    if (productIds.length) {
      await tx.savedItem.deleteMany({ where: { productId: { in: productIds } } });
      await tx.productImage.deleteMany({ where: { productId: { in: productIds } } });
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    }

    await tx.savedItem.deleteMany({ where: { companyId } });
    await tx.sellerProfile.deleteMany({ where: { companyId } });
    await tx.buyerProfile.deleteMany({ where: { companyId } });
    await tx.verificationRequest.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
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
  const storageResult = await deleteStorageFiles(storageFiles);

  return {
    companyId,
    productCount: productIds.length,
    inquiryCount: inquiryIds.length,
    dealCount: dealIds.length,
    attachmentCount: attachmentIds.length,
    ...storageResult,
  };
}
