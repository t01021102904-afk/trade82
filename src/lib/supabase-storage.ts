import "server-only";

import { createClient } from "@supabase/supabase-js";

export type UploadType =
  | "company_logo"
  | "product_image"
  | "profile_avatar"
  | "verification_document"
  | "contract_file";

type FileRule = {
  folder: string;
  maxBytes: number;
  extensions: ReadonlySet<string>;
  mimeTypes: ReadonlySet<string>;
  visibility: "public" | "private";
};

type UploadLocale = "en" | "ko";

const MB = 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SUSPICIOUS_EXTENSIONS = new Set([
  "bat",
  "cmd",
  "exe",
  "htm",
  "html",
  "js",
  "php",
  "sh",
  "svg",
  "zip",
  "dmg",
]);

export const FILE_RULES: Record<UploadType, FileRule> = {
  company_logo: {
    folder: "company-logos",
    maxBytes: 25 * MB,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  product_image: {
    folder: "product-images",
    maxBytes: 50 * MB,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  profile_avatar: {
    folder: "profile-avatars",
    maxBytes: 25 * MB,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  verification_document: {
    folder: "verification-documents",
    maxBytes: 10 * MB,
    extensions: DOCUMENT_EXTENSIONS,
    mimeTypes: DOCUMENT_MIME_TYPES,
    visibility: "private",
  },
  contract_file: {
    folder: "contract-files",
    maxBytes: 20 * MB,
    extensions: DOCUMENT_EXTENSIONS,
    mimeTypes: DOCUMENT_MIME_TYPES,
    visibility: "private",
  },
};

export class StorageValidationError extends Error {}
export class StorageConfigurationError extends Error {}
export class StorageUploadError extends Error {}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new StorageConfigurationError("Storage service is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPublicStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "marketplace-assets";
}

export function getPrivateStorageBucket() {
  return process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || "marketplace-private";
}

function isPublicImageUpload(uploadType: UploadType) {
  return FILE_RULES[uploadType].visibility === "public";
}

function supportedPublicImageMessage(locale: UploadLocale) {
  return locale === "ko"
    ? "지원하지 않는 파일 형식입니다. JPG, PNG, WebP 또는 AVIF 파일을 업로드해주세요."
    : "This file type is not supported. Please upload JPG, PNG, WebP, or AVIF.";
}

function supportedPrivateDocumentMessage(locale: UploadLocale) {
  return locale === "ko"
    ? "지원하지 않는 파일 형식입니다. PDF, JPG, PNG 또는 WebP 파일을 업로드해주세요."
    : "This file type is not supported. Please upload PDF, JPG, PNG, or WebP.";
}

function heicUnsupportedMessage(locale: UploadLocale) {
  return locale === "ko"
    ? "HEIC 이미지는 아직 지원하지 않습니다. JPG 또는 PNG로 변환 후 업로드해주세요."
    : "HEIC images are not supported yet. Please convert to JPG or PNG.";
}

function maxSizeMessage(uploadType: UploadType, locale: UploadLocale) {
  const maxMb = Math.round(FILE_RULES[uploadType].maxBytes / MB);

  if (locale === "ko") {
    if (uploadType === "product_image") {
      return `이미지 용량이 너무 큽니다. 상품 이미지는 최대 ${maxMb}MB까지 업로드할 수 있습니다.`;
    }
    if (isPublicImageUpload(uploadType)) {
      return `이미지 용량이 너무 큽니다. 프로필 사진과 회사 로고는 최대 ${maxMb}MB까지 업로드할 수 있습니다.`;
    }
    return `파일 용량이 너무 큽니다. 최대 ${maxMb}MB까지 업로드할 수 있습니다.`;
  }

  if (uploadType === "product_image") {
    return `This image is too large. Maximum size is ${maxMb}MB for product images.`;
  }
  if (isPublicImageUpload(uploadType)) {
    return `This image is too large. Maximum size is ${maxMb}MB for profile photos and company logos.`;
  }
  return `This file is too large. Maximum size is ${maxMb}MB.`;
}

export function validateFileType(
  file: File,
  uploadType: UploadType,
  locale: UploadLocale = "en",
) {
  const rule = FILE_RULES[uploadType];
  const parts = file.name
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const extension = parts.at(-1) ?? "";
  const hasSuspiciousPart = parts.some((part) =>
    SUSPICIOUS_EXTENSIONS.has(part),
  );
  const mimeType = file.type.toLowerCase();

  if (HEIC_EXTENSIONS.has(extension) || HEIC_MIME_TYPES.has(mimeType)) {
    throw new StorageValidationError(heicUnsupportedMessage(locale));
  }

  if (
    !extension ||
    hasSuspiciousPart ||
    !rule.extensions.has(extension) ||
    !rule.mimeTypes.has(mimeType)
  ) {
    throw new StorageValidationError(
      rule.visibility === "public"
        ? supportedPublicImageMessage(locale)
        : supportedPrivateDocumentMessage(locale),
    );
  }
}

export function validateFileSize(
  file: File,
  uploadType: UploadType,
  locale: UploadLocale = "en",
) {
  const rule = FILE_RULES[uploadType];
  if (file.size <= 0) {
    throw new StorageValidationError(
      locale === "ko"
        ? "빈 파일은 업로드할 수 없습니다."
        : "Empty files cannot be uploaded.",
    );
  }
  if (file.size > rule.maxBytes) {
    throw new StorageValidationError(maxSizeMessage(uploadType, locale));
  }
}

export function sanitizeStoredFilename(name: string) {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    .replace(/[^\w .()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "uploaded-file").slice(0, 255);
}

export async function uploadPublicFile({
  path,
  body,
  contentType,
  cacheControl = "31536000",
}: {
  path: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const client = getSupabaseAdminClient();
  const bucket = getPublicStorageBucket();
  const { error } = await client.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl,
    upsert: false,
  });
  if (error) {
    throw new StorageUploadError("Storage upload was rejected.");
  }
  return { path, publicUrl: getPublicFileUrl(path) };
}

export async function uploadPrivateFile({
  path,
  body,
  contentType,
}: {
  path: string;
  body: Buffer;
  contentType: string;
}) {
  const client = getSupabaseAdminClient();
  const bucket = getPrivateStorageBucket();
  const { error } = await client.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new StorageUploadError("Storage upload was rejected.");
  }
  return { path };
}

export function getPublicFileUrl(path: string) {
  return getSupabaseAdminClient().storage
    .from(getPublicStorageBucket())
    .getPublicUrl(path).data.publicUrl;
}

export async function createSignedPrivateFileUrl(
  path: string,
  expiresInSeconds = 300,
) {
  const { data, error } = await getSupabaseAdminClient().storage
    .from(getPrivateStorageBucket())
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteStorageFile(
  path: string,
  visibility: "public" | "private",
) {
  const bucket =
    visibility === "public"
      ? getPublicStorageBucket()
      : getPrivateStorageBucket();
  const { error } = await getSupabaseAdminClient().storage
    .from(bucket)
    .remove([path]);
  if (error) throw new Error(error.message);
}

export async function ensureStorageBuckets() {
  const client = getSupabaseAdminClient();
  const publicBucket = getPublicStorageBucket();
  const privateBucket = getPrivateStorageBucket();
  const { data, error } = await client.storage.listBuckets();
  if (error) throw new Error(error.message);

  const buckets = new Map(data.map((bucket) => [bucket.name, bucket]));
  if (!buckets.has(publicBucket)) {
    const result = await client.storage.createBucket(publicBucket, {
      public: true,
      fileSizeLimit: 50 * MB,
      allowedMimeTypes: [...IMAGE_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  } else if (!buckets.get(publicBucket)?.public) {
    const result = await client.storage.updateBucket(publicBucket, {
      public: true,
      fileSizeLimit: 50 * MB,
      allowedMimeTypes: [...IMAGE_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  }

  if (!buckets.has(privateBucket)) {
    const result = await client.storage.createBucket(privateBucket, {
      public: false,
      fileSizeLimit: 100 * MB,
      allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  } else {
    const result = await client.storage.updateBucket(privateBucket, {
      public: false,
      fileSizeLimit: 100 * MB,
      allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  }

  return { publicBucket, privateBucket };
}
