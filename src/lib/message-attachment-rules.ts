export const MESSAGE_ATTACHMENT_LIMITS = {
  maxImageBytes: 25 * 1024 * 1024,
  maxPdfBytes: 100 * 1024 * 1024,
  maxFilesPerMessage: 10,
  maxTotalBytesPerMessage: 250 * 1024 * 1024,
  signedUrlExpiresInSeconds: 300,
} as const;

export const MESSAGE_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
]);

export const MESSAGE_ATTACHMENT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MESSAGE_ATTACHMENT_PDF_MIME_TYPES = new Set(["application/pdf"]);

export const MESSAGE_ATTACHMENT_BLOCKED_EXTENSIONS = new Set([
  "7z",
  "app",
  "bat",
  "cmd",
  "dmg",
  "exe",
  "htm",
  "html",
  "js",
  "php",
  "rar",
  "sh",
  "svg",
  "zip",
]);

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}
