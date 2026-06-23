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

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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

export const FILE_RULES: Record<UploadType, FileRule> = {
  company_logo: {
    folder: "company-logos",
    maxBytes: 2 * 1024 * 1024,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  product_image: {
    folder: "product-images",
    maxBytes: 5 * 1024 * 1024,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  profile_avatar: {
    folder: "profile-avatars",
    maxBytes: 2 * 1024 * 1024,
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    visibility: "public",
  },
  verification_document: {
    folder: "verification-documents",
    maxBytes: 10 * 1024 * 1024,
    extensions: DOCUMENT_EXTENSIONS,
    mimeTypes: DOCUMENT_MIME_TYPES,
    visibility: "private",
  },
  contract_file: {
    folder: "contract-files",
    maxBytes: 20 * 1024 * 1024,
    extensions: DOCUMENT_EXTENSIONS,
    mimeTypes: DOCUMENT_MIME_TYPES,
    visibility: "private",
  },
};

export class StorageValidationError extends Error {}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured.");
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

export function validateFileType(file: File, uploadType: UploadType) {
  const rule = FILE_RULES[uploadType];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    !rule.extensions.has(extension) ||
    !rule.mimeTypes.has(file.type.toLowerCase())
  ) {
    throw new StorageValidationError(
      rule.visibility === "public"
        ? "JPG, PNG, WEBP 파일만 업로드할 수 있어요."
        : "PDF, JPG, PNG, WEBP 파일만 업로드할 수 있어요.",
    );
  }
}

export function validateFileSize(file: File, uploadType: UploadType) {
  const rule = FILE_RULES[uploadType];
  if (file.size > rule.maxBytes) {
    throw new StorageValidationError(
      `${Math.round(rule.maxBytes / 1024 / 1024)}MB 이하 파일만 업로드해 주세요.`,
    );
  }
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: [...IMAGE_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  } else if (!buckets.get(publicBucket)?.public) {
    const result = await client.storage.updateBucket(publicBucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: [...IMAGE_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  }

  if (!buckets.has(privateBucket)) {
    const result = await client.storage.createBucket(privateBucket, {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024,
      allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  } else if (buckets.get(privateBucket)?.public) {
    const result = await client.storage.updateBucket(privateBucket, {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024,
      allowedMimeTypes: [...DOCUMENT_MIME_TYPES],
    });
    if (result.error) throw new Error(result.error.message);
  }

  return { publicBucket, privateBucket };
}
