import sharp from "sharp";

import {
  HOMEPAGE_PROMOTION_IMAGE_MAX_BYTES,
  HOMEPAGE_PROMOTION_PDF_MAX_BYTES,
} from "@/lib/homepage-promotion-constants";

export {
  HOMEPAGE_PROMOTION_IMAGE_MAX_BYTES,
  HOMEPAGE_PROMOTION_MAX_ITEMS,
  HOMEPAGE_PROMOTION_PDF_MAX_BYTES,
} from "@/lib/homepage-promotion-constants";

const imageRules = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
} as const;

export type HomepagePromotionMediaTypeValue = "IMAGE" | "PDF";

export type HomepagePromotionInput = {
  adminTitle: string;
  altTextEn: string;
  altTextKo: string;
  mediaType: HomepagePromotionMediaTypeValue;
  destinationUrl: string | null;
  openInNewTab: boolean;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usePdfAsDestination: boolean;
};

function validationFailure(message: string, status = 400): never {
  throw new Response(message, { status });
}

function textField(form: FormData, key: string, max: number, required = true) {
  const value = form.get(key);
  if (typeof value !== "string") {
    if (!required) return "";
    validationFailure(`${key} is required.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) validationFailure(`${key} is required.`);
  if (trimmed.length > max) validationFailure(`${key} is too long.`);
  return trimmed;
}

function booleanField(form: FormData, key: string, fallback = false) {
  const value = form.get(key);
  if (value === null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  validationFailure(`${key} is invalid.`);
}

function dateField(form: FormData, key: string) {
  const value = textField(form, key, 40, false);
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) validationFailure(`${key} is invalid.`);
  return date;
}

export function validatePromotionDestination(value: string | null | undefined) {
  const destination = value?.trim() ?? "";
  if (!destination) return null;
  if (
    destination.length > 2_048 ||
    /[\u0000-\u001f\u007f]/.test(destination) ||
    destination.startsWith("//")
  ) {
    validationFailure("destinationUrl is invalid.");
  }
  if (destination.startsWith("/")) {
    try {
      const parsed = new URL(destination, "https://trade82.com");
      if (parsed.origin !== "https://trade82.com") {
        validationFailure("destinationUrl is invalid.");
      }
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      validationFailure("destinationUrl is invalid.");
    }
  }
  try {
    const parsed = new URL(destination);
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      validationFailure("destinationUrl must be an internal path or HTTPS URL.");
    }
    return parsed.toString();
  } catch {
    validationFailure("destinationUrl is invalid.");
  }
}

export function parseHomepagePromotionForm(
  form: FormData,
): HomepagePromotionInput {
  const mediaType = textField(form, "mediaType", 10);
  if (mediaType !== "IMAGE" && mediaType !== "PDF") {
    validationFailure("mediaType is invalid.");
  }
  const startsAt = dateField(form, "startsAt");
  const endsAt = dateField(form, "endsAt");
  if (startsAt && endsAt && endsAt <= startsAt) {
    validationFailure("endsAt must be after startsAt.");
  }

  return {
    adminTitle: textField(form, "adminTitle", 160),
    altTextEn: textField(form, "altTextEn", 300),
    altTextKo: textField(form, "altTextKo", 300),
    mediaType,
    destinationUrl: validatePromotionDestination(
      textField(form, "destinationUrl", 2_048, false),
    ),
    openInNewTab: booleanField(form, "openInNewTab"),
    isActive: booleanField(form, "isActive", true),
    startsAt,
    endsAt,
    usePdfAsDestination: booleanField(form, "usePdfAsDestination"),
  };
}

export function optionalFile(form: FormData, key: string) {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function extensionOf(name: string) {
  const normalized = name.toLowerCase();
  const extension = normalized.includes(".") ? normalized.split(".").at(-1) : "";
  return extension ?? "";
}

function isImageSignature(buffer: Buffer, mimeType: keyof typeof imageRules) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function validatePromotionUpload(
  file: File,
  kind: "thumbnail" | "pdf",
) {
  if (
    !file.name ||
    file.name.includes("/") ||
    file.name.includes("\\") ||
    file.name.includes("\u0000")
  ) {
    validationFailure("Filename is invalid.");
  }
  const extension = extensionOf(file.name);
  const mimeType = file.type.toLowerCase();
  const maxBytes =
    kind === "thumbnail"
      ? HOMEPAGE_PROMOTION_IMAGE_MAX_BYTES
      : HOMEPAGE_PROMOTION_PDF_MAX_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    validationFailure(`${kind} file size is invalid.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size) {
    validationFailure(`${kind} upload size did not match its payload.`);
  }

  if (kind === "thumbnail") {
    if (
      !(mimeType in imageRules) ||
      !imageRules[mimeType as keyof typeof imageRules].has(
        extension as never,
      ) ||
      !isImageSignature(buffer, mimeType as keyof typeof imageRules)
    ) {
      validationFailure("Thumbnail must be a valid JPG, PNG, or WebP image.");
    }
    try {
      const metadata = await sharp(buffer, { failOn: "error" }).metadata();
      const expectedFormat =
        mimeType === "image/jpeg"
          ? "jpeg"
          : mimeType === "image/png"
            ? "png"
            : "webp";
      if (
        metadata.format !== expectedFormat ||
        !metadata.width ||
        !metadata.height ||
        metadata.width * metadata.height > 100_000_000
      ) {
        validationFailure("Thumbnail image data is invalid.");
      }
    } catch (error) {
      if (error instanceof Response) throw error;
      validationFailure("Thumbnail image data is invalid.");
    }
  } else if (
    mimeType !== "application/pdf" ||
    extension !== "pdf" ||
    buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    validationFailure("PDF must be a valid PDF file.");
  }

  return { buffer, mimeType, extension };
}
