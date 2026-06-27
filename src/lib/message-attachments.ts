import "server-only";

import crypto from "node:crypto";

import type { MessageAttachmentFileType } from "@/generated/prisma/client";
import { isAdminUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  MESSAGE_ATTACHMENT_ALLOWED_EXTENSIONS,
  MESSAGE_ATTACHMENT_BLOCKED_EXTENSIONS,
  MESSAGE_ATTACHMENT_IMAGE_MIME_TYPES,
  MESSAGE_ATTACHMENT_LIMITS,
  MESSAGE_ATTACHMENT_PDF_MIME_TYPES,
} from "@/lib/message-attachment-rules";
import { sanitizeStoredFilename } from "@/lib/supabase-storage";

export class MessageAttachmentValidationError extends Error {}

export function sha256Hex(buffer: Buffer | string) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function parseFilenameParts(filename: string) {
  return filename
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getMessageAttachmentFileType(file: File): MessageAttachmentFileType {
  const mimeType = file.type.toLowerCase();
  if (MESSAGE_ATTACHMENT_IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (MESSAGE_ATTACHMENT_PDF_MIME_TYPES.has(mimeType)) return "pdf";
  return "document";
}

export function validateMessageAttachmentFile(file: File) {
  const parts = parseFilenameParts(file.name);
  const extension = parts.at(-1) ?? "";
  const mimeType = file.type.toLowerCase();
  const hasBlockedExtension = parts.some((part) =>
    MESSAGE_ATTACHMENT_BLOCKED_EXTENSIONS.has(part),
  );

  if (
    !extension ||
    hasBlockedExtension ||
    !MESSAGE_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)
  ) {
    throw new MessageAttachmentValidationError(
      "Only PDF, JPG, PNG, and WEBP files can be attached.",
    );
  }

  if (
    !MESSAGE_ATTACHMENT_IMAGE_MIME_TYPES.has(mimeType) &&
    !MESSAGE_ATTACHMENT_PDF_MIME_TYPES.has(mimeType)
  ) {
    throw new MessageAttachmentValidationError(
      "The file type does not match an allowed PDF or image format.",
    );
  }

  if (file.size <= 0) {
    throw new MessageAttachmentValidationError("Empty files cannot be attached.");
  }

  const fileType = getMessageAttachmentFileType(file);
  const maxBytes =
    fileType === "pdf"
      ? MESSAGE_ATTACHMENT_LIMITS.maxPdfBytes
      : MESSAGE_ATTACHMENT_LIMITS.maxImageBytes;
  if (file.size > maxBytes) {
    throw new MessageAttachmentValidationError(
      fileType === "pdf"
        ? "PDF files must be 100MB or smaller."
        : "Image files must be 25MB or smaller.",
    );
  }

  return { extension, fileType };
}

export function buildStoredAttachmentFilename(file: File, extension: string) {
  const safeName = sanitizeStoredFilename(file.name);
  const baseName = safeName.replace(/\.[^.]+$/, "").slice(0, 80) || "attachment";
  return `${baseName}-${crypto.randomUUID()}.${extension}`;
}

export function buildMessageAttachmentStoragePath({
  inquiryId,
  fileType,
  storedFilename,
}: {
  inquiryId: string;
  fileType: MessageAttachmentFileType;
  storedFilename: string;
}) {
  const folder = fileType === "image" ? "message-images" : "message-documents";
  return `${folder}/${inquiryId}/pending/${storedFilename}`;
}

export async function getInquiryParticipant({
  inquiryId,
  userId,
  allowAdmin = false,
}: {
  inquiryId: string;
  userId: string;
  allowAdmin?: boolean;
}) {
  const inquiry = await getDb().inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      buyerCompany: { select: { id: true, ownerUserId: true, legalName: true, tradeName: true } },
      sellerCompany: { select: { id: true, ownerUserId: true, legalName: true, tradeName: true } },
    },
  });

  if (!inquiry) return null;

  const company =
    inquiry.buyerCompany.ownerUserId === userId
      ? inquiry.buyerCompany
      : inquiry.sellerCompany.ownerUserId === userId
        ? inquiry.sellerCompany
        : null;

  if (company) return { inquiry, company, isAdmin: false };
  if (allowAdmin && (await isAdminUser())) return { inquiry, company: null, isAdmin: true };
  return null;
}
