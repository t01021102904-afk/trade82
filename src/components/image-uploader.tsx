"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import type { UploadedListingImage } from "@/lib/marketplace";
import { cx } from "@/lib/utils";

type UploadKind = "company_logo" | "product_image" | "profile_avatar";

type PendingImage = {
  id: string;
  previewUrl: string;
  fileName: string;
  uploaded: UploadedListingImage | null;
  status: "uploading" | "ready" | "error";
  error: string;
};

const acceptedExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const heicTypes = new Set(["image/heic", "image/heif"]);
const heicExtensions = new Set(["heic", "heif"]);
const suspiciousExtensions = new Set([
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
const MB = 1024 * 1024;
const maxProductSize = 50 * MB;
const maxProfileSize = 25 * MB;

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function fileParts(file: File) {
  return file.name
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isHeicImage(file: File) {
  return (
    heicTypes.has(file.type.toLowerCase()) ||
    heicExtensions.has(extensionOf(file))
  );
}

function isAcceptedImage(file: File) {
  const parts = fileParts(file);
  return (
    file.size > 0 &&
    acceptedTypes.has(file.type.toLowerCase()) &&
    acceptedExtensions.has(extensionOf(file)) &&
    !parts.some((part) => suspiciousExtensions.has(part))
  );
}

function imageValidationError(
  file: File,
  kind: UploadKind,
  copy: ReturnType<typeof uploadCopy>,
) {
  const maxSize = kind === "product_image" ? maxProductSize : maxProfileSize;

  if (file.size <= 0) return copy.empty;
  if (isHeicImage(file)) return copy.heic;
  if (!isAcceptedImage(file)) return copy.invalidImage;
  if (file.size > maxSize) {
    return kind === "product_image"
      ? copy.productTooLarge
      : copy.profileTooLarge;
  }

  return "";
}

function uploadCopy(locale: "en" | "ko") {
  return locale === "ko"
    ? {
        empty: "빈 파일은 업로드할 수 없습니다.",
        invalidImage:
          "지원하지 않는 파일 형식입니다. JPG, PNG, WebP 또는 AVIF 파일을 업로드해주세요.",
        heic:
          "HEIC 이미지는 아직 지원하지 않습니다. JPG 또는 PNG로 변환 후 업로드해주세요.",
        productTooLarge:
          "이미지 용량이 너무 큽니다. 상품 이미지는 최대 50MB까지 업로드할 수 있습니다.",
        profileTooLarge:
          "이미지 용량이 너무 큽니다. 프로필 사진과 회사 로고는 최대 25MB까지 업로드할 수 있습니다.",
        generic: "업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        network:
          "네트워크 문제로 업로드하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
        tooMany:
          "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.",
        productHelp:
          "JPG, PNG, WebP, AVIF 파일을 업로드할 수 있습니다. 상품 이미지는 파일당 최대 50MB까지 가능합니다.",
        profileHelp:
          "JPG, PNG, WebP, AVIF 파일을 업로드할 수 있습니다. 프로필 사진과 회사 로고는 최대 25MB까지 가능합니다.",
        tooManyImages: "이미지는 최대 12장까지 등록할 수 있습니다.",
        productImages: "상품 이미지",
        primary: "대표",
        remove: "삭제",
        uploading: "업로드 중",
        addPhoto: "사진 추가",
        changePhoto: "사진 변경",
        reorderHelp:
          "첫 번째 사진이 대표 이미지로 사용됩니다. 드래그하거나 화살표로 순서를 변경할 수 있습니다.",
      }
    : {
        empty: "Empty files cannot be uploaded.",
        invalidImage:
          "This file type is not supported. Please upload JPG, PNG, WebP, or AVIF.",
        heic:
          "HEIC images are not supported yet. Please convert to JPG or PNG.",
        productTooLarge:
          "This image is too large. Maximum size is 50MB for product images.",
        profileTooLarge:
          "This image is too large. Maximum size is 25MB for profile photos and company logos.",
        generic: "Upload failed. Please try again.",
        network:
          "Network error while uploading. Check your connection and try again.",
        tooMany: "Too many upload attempts. Please try again shortly.",
        productHelp:
          "Upload JPG, PNG, WebP, or AVIF. Product images can be up to 50MB each.",
        profileHelp:
          "Upload JPG, PNG, WebP, or AVIF. Profile photos and company logos can be up to 25MB.",
        tooManyImages: "You can add up to 12 images.",
        productImages: "Product images",
        primary: "Primary",
        remove: "Remove",
        uploading: "Uploading",
        addPhoto: "Add photo",
        changePhoto: "Change photo",
        reorderHelp:
          "The first photo is used as the primary image. Drag or use the arrows to reorder.",
      };
}

export function ListingImageUploader({
  value,
  onChange,
  onUploadingChange,
}: {
  value: UploadedListingImage[];
  onChange: (images: UploadedListingImage[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const { locale } = useI18n();
  const copy = uploadCopy(locale);
  const [items, setItems] = useState<PendingImage[]>(() =>
    value.map((image) => ({
      id: image.storagePath,
      previewUrl: image.cardUrl,
      fileName: image.storagePath.split("/").pop() ?? "image",
      uploaded: image,
      status: "ready",
      error: "",
    })),
  );
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    onUploadingChange?.(items.some((item) => item.status === "uploading"));
  }, [items, onUploadingChange]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function addFiles(files: File[]) {
    setError("");
    if (items.length + files.length > 12) {
      setError(copy.tooManyImages);
      return;
    }

    const validationError = files
      .map((file) => imageValidationError(file, "product_image", copy))
      .find(Boolean);
    if (validationError) {
      setError(validationError);
      return;
    }

    const additions = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return {
        id: crypto.randomUUID(),
        previewUrl,
        fileName: file.name,
        uploaded: null,
        status: "uploading" as const,
        error: "",
        file,
      };
    });

    setItems((current) => [
      ...current,
      ...additions.map((item) => ({
        id: item.id,
        previewUrl: item.previewUrl,
        fileName: item.fileName,
        uploaded: item.uploaded,
        status: item.status,
        error: item.error,
      })),
    ]);

    await Promise.all(
      additions.map(async ({ file, ...pending }) => {
        const result = await uploadImage(file, "product_image", copy, {
          locale,
        });
        setItems((current) =>
          current.map((item) =>
            item.id === pending.id
              ? result.ok
                ? {
                    ...item,
                    uploaded: result.image,
                    status: "ready",
                    error: "",
                  }
                : {
                    ...item,
                    status: "error",
                    error: result.error,
                  }
              : item,
          ),
        );
      }),
    );
  }

  useEffect(() => {
    const uploaded = items.flatMap((item) =>
      item.status === "ready" && item.uploaded ? [item.uploaded] : [],
    );
    if (!sameImages(uploaded, value)) {
      onChange(uploaded);
    }
  }, [items, onChange, value]);

  function remove(id: string) {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function move(id: string, offset: number) {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function moveBefore(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === sourceId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-900">
          {copy.productImages}
        </span>
        <span className="text-sm text-zinc-500">{items.length}/12</span>
      </div>
      <p className="text-xs leading-5 text-zinc-500">{copy.productHelp}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDraggedId(item.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedId) moveBefore(draggedId, item.id);
              setDraggedId(null);
            }}
            className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
          >
            <Image
              src={item.previewUrl}
              alt={`${item.fileName} 미리보기`}
              fill
              unoptimized
              className="object-cover"
            />
            {index === 0 ? (
              <span className="absolute left-2 top-2 rounded bg-zinc-950 px-2 py-1 text-xs font-medium text-white">
                {copy.primary}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/65 p-1.5">
              <button
                type="button"
                onClick={() => move(item.id, -1)}
                disabled={index === 0}
                className="size-9 rounded bg-white/90 text-sm text-zinc-900 disabled:opacity-40"
                aria-label="이미지를 앞으로 이동"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="h-9 rounded bg-white/90 px-2 text-xs font-medium text-red-700"
              >
                {copy.remove}
              </button>
              <button
                type="button"
                onClick={() => move(item.id, 1)}
                disabled={index === items.length - 1}
                className="size-9 rounded bg-white/90 text-sm text-zinc-900 disabled:opacity-40"
                aria-label="이미지를 뒤로 이동"
              >
                →
              </button>
            </div>
            {item.status === "uploading" ? (
              <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-medium text-zinc-700">
                {copy.uploading}
              </span>
            ) : null}
            {item.status === "error" ? (
              <span className="absolute inset-0 flex items-center justify-center bg-red-50/95 p-3 text-center text-xs text-red-700">
                {item.error}
              </span>
            ) : null}
          </div>
        ))}
        {items.length < 12 ? (
          <label className="flex aspect-square min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
            <span className="text-2xl leading-none">+</span>
            <span className="mt-2">{copy.addPhoto}</span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) void addFiles(files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-zinc-500">{copy.reorderHelp}</p>
    </div>
  );
}

export function SingleImageUploader({
  kind,
  imageUrl,
  label,
  circular = true,
  onUploaded,
  onUploadingChange,
  companyId,
  onUploadError,
}: {
  kind: Exclude<UploadKind, "product_image">;
  imageUrl?: string;
  label: string;
  circular?: boolean;
  onUploaded: (image: UploadedListingImage) => void;
  onUploadingChange?: (uploading: boolean) => void;
  companyId?: string;
  onUploadError?: (message: string) => void;
}) {
  const { locale } = useI18n();
  const copy = uploadCopy(locale);
  const [previewUrl, setPreviewUrl] = useState(imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const localPreview = useRef("");

  useEffect(() => {
    if (!localPreview.current) setPreviewUrl(imageUrl ?? "");
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    };
  }, []);

  async function select(file: File) {
    setError("");
    const validationError = imageValidationError(file, kind, copy);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    localPreview.current = URL.createObjectURL(file);
    setPreviewUrl(localPreview.current);
    setUploading(true);
    onUploadingChange?.(true);

    const result = await uploadImage(file, kind, copy, { companyId, locale });
    if (result.ok) {
      if (localPreview.current) {
        URL.revokeObjectURL(localPreview.current);
        localPreview.current = "";
      }
      setPreviewUrl(result.image.mainUrl || result.image.cardUrl || result.image.originalUrl);
      if (kind === "company_logo" && process.env.NODE_ENV !== "production") {
        console.info("[company-logo] upload response", {
          storagePath: result.image.storagePath,
          originalUrl: result.image.originalUrl,
          cardUrl: result.image.cardUrl,
          mainUrl: result.image.mainUrl,
          detailUrl: result.image.detailUrl,
        });
      }
      onUploaded(result.image);
    } else {
      if (localPreview.current) {
        URL.revokeObjectURL(localPreview.current);
        localPreview.current = "";
      }
      setPreviewUrl(imageUrl ?? "");
      setError(result.error);
      onUploadError?.(result.error);
    }
    setUploading(false);
    onUploadingChange?.(false);
  }

  return (
    <div className="grid justify-items-start gap-2">
      <label
        className={cx(
          "group relative block size-28 cursor-pointer overflow-hidden border border-zinc-200 bg-zinc-100",
          circular ? "rounded-full" : "rounded-md",
        )}
      >
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => {
              if (localPreview.current) {
                URL.revokeObjectURL(localPreview.current);
                localPreview.current = "";
              }
              setPreviewUrl("");
            }}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-3xl text-zinc-400">
            +
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {uploading ? copy.uploading : copy.changePhoto}
        </span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          disabled={uploading}
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void select(file);
            event.target.value = "";
          }}
        />
      </label>
      <p className="max-w-xs text-xs leading-5 text-zinc-500">
        {copy.profileHelp}
      </p>
      {error ? <p className="max-w-xs text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

async function uploadImage(
  file: File,
  uploadType: UploadKind,
  copy: ReturnType<typeof uploadCopy>,
  metadata?: { companyId?: string; locale?: "en" | "ko" },
) {
  const formData = new FormData();
  formData.set("uploadType", uploadType);
  formData.set("file", file);
  if (metadata?.companyId) formData.set("companyId", metadata.companyId);

  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: metadata?.locale
        ? { "x-trade82-locale": metadata.locale }
        : undefined,
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as
      | (Partial<UploadedListingImage> & { error?: string })
      | null;

    if (
      response.ok &&
      result?.originalUrl &&
      result.cardUrl &&
      result.mainUrl &&
      result.detailUrl &&
      result.storagePath
    ) {
      return {
        ok: true as const,
        image: {
          originalUrl: result.originalUrl,
          cardUrl: result.cardUrl,
          mainUrl: result.mainUrl,
          detailUrl: result.detailUrl,
          storagePath: result.storagePath,
          width: result.width ?? null,
          height: result.height ?? null,
        },
      };
    }

    return {
      ok: false as const,
      error:
        result?.error ??
        (response.status === 429 ? copy.tooMany : copy.generic),
    };
  } catch {
    return {
      ok: false as const,
      error: copy.network,
    };
  }
}

function sameImages(
  left: UploadedListingImage[],
  right: UploadedListingImage[],
) {
  return (
    left.length === right.length &&
    left.every(
      (image, index) => image.storagePath === right[index]?.storagePath,
    )
  );
}
