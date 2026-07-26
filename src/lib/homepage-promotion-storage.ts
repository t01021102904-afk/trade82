import "server-only";

import { randomUUID } from "node:crypto";

import {
  ensurePublicStorageBucket,
  sanitizeStoredFilename,
  uploadPublicFile,
} from "@/lib/supabase-storage";
import { validatePromotionUpload } from "@/lib/homepage-promotion-validation";

export async function uploadHomepagePromotionFile({
  promotionId,
  kind,
  file,
}: {
  promotionId: string;
  kind: "thumbnail" | "pdf";
  file: File;
}) {
  if (!/^[A-Za-z0-9_-]+$/.test(promotionId)) {
    throw new Response("Invalid promotion ID.", { status: 400 });
  }
  const validated = await validatePromotionUpload(file, kind);
  const safeFilename = sanitizeStoredFilename(file.name).replace(/\s+/g, "-");
  const path = [
    "homepage-promotions",
    promotionId,
    `${randomUUID()}-${safeFilename}`,
  ].join("/");
  if (
    path.includes("..") ||
    path.startsWith("/") ||
    path.includes("\\")
  ) {
    throw new Response("Invalid storage path.", { status: 400 });
  }
  await ensurePublicStorageBucket();
  return uploadPublicFile({
    path,
    body: validated.buffer,
    contentType: validated.mimeType,
  });
}
