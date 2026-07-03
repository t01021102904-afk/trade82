import "server-only";

import crypto from "node:crypto";

import {
  getSupabaseAdminClient,
  sanitizeStoredFilename,
  StorageConfigurationError,
  StorageUploadError,
} from "@/lib/supabase-storage";

const MB = 1024 * 1024;
const DOCUMENT_STORAGE_MAX_BYTES = 25 * MB;
const DOCUMENT_STORAGE_ALLOWED_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "txt",
  "webp",
  "xls",
  "xlsx",
]);
const DOCUMENT_STORAGE_BLOCKED_EXTENSIONS = new Set([
  "bat",
  "cmd",
  "dmg",
  "exe",
  "htm",
  "html",
  "js",
  "php",
  "sh",
  "svg",
  "zip",
]);
const DOCUMENT_STORAGE_ALLOWED_MIME_TYPES = new Set([
  "application/csv",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

export class DocumentStorageValidationError extends Error {}

export function getDocumentStorageBucket() {
  const bucket = process.env.SUPABASE_DOCUMENT_STORAGE_BUCKET?.trim();
  if (!bucket) {
    throw new StorageConfigurationError("Document storage bucket is not configured.");
  }
  return bucket;
}

function storageBlobFromBuffer(body: Buffer, contentType: string) {
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(body);
  return new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
}

function filenameParts(filename: string) {
  return filename
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function validateTradeDocumentFile(file: File) {
  const parts = filenameParts(file.name);
  const extension = parts.at(-1) ?? "";
  const mimeType = file.type.toLowerCase();
  const hasBlockedExtension = parts.some((part) =>
    DOCUMENT_STORAGE_BLOCKED_EXTENSIONS.has(part),
  );

  if (
    !extension ||
    hasBlockedExtension ||
    !DOCUMENT_STORAGE_ALLOWED_EXTENSIONS.has(extension) ||
    !DOCUMENT_STORAGE_ALLOWED_MIME_TYPES.has(mimeType)
  ) {
    throw new DocumentStorageValidationError(
      "Unsupported document type. Upload PDF, Word, Excel, CSV, TXT, JPG, PNG, or WebP files.",
    );
  }

  if (file.size <= 0) {
    throw new DocumentStorageValidationError("Empty files cannot be uploaded.");
  }

  if (file.size > DOCUMENT_STORAGE_MAX_BYTES) {
    throw new DocumentStorageValidationError(
      "This document is too large. Maximum size is 25MB.",
    );
  }

  return { extension, mimeType };
}

export function buildTradeDocumentStoragePath({
  companyId,
  category,
  filename,
}: {
  companyId: string;
  category: string;
  filename: string;
}) {
  return `trade-documents/${companyId}/${category}/${crypto.randomUUID()}-${filename}`;
}

export function buildTradeDocumentFilename(file: File, extension: string) {
  const safeName = sanitizeStoredFilename(file.name);
  const baseName = safeName.replace(/\.[^.]+$/, "").slice(0, 90) || "document";
  return `${baseName}.${extension}`;
}

export async function uploadTradeDocumentFile({
  path,
  body,
  contentType,
}: {
  path: string;
  body: Buffer;
  contentType: string;
}) {
  const bucket = getDocumentStorageBucket();
  const { error } = await getSupabaseAdminClient().storage
    .from(bucket)
    .upload(path, storageBlobFromBuffer(body, contentType), {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new StorageUploadError(error.message || "Document upload was rejected.");
  }

  return { bucket, path };
}

export async function createSignedTradeDocumentUrl(
  path: string,
  expiresInSeconds = 300,
) {
  const { data, error } = await getSupabaseAdminClient().storage
    .from(getDocumentStorageBucket())
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteTradeDocumentFile(path: string) {
  const { error } = await getSupabaseAdminClient().storage
    .from(getDocumentStorageBucket())
    .remove([path]);
  if (error) throw new Error(error.message);
}
