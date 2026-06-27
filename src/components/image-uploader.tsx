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

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const suspiciousExtensions = new Set([
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
]);
const maxProductSize = 5 * 1024 * 1024;
const maxProfileSize = 2 * 1024 * 1024;

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isAcceptedImage(file: File) {
  const parts = file.name
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    file.size > 0 &&
    acceptedTypes.has(file.type) &&
    acceptedExtensions.has(extensionOf(file)) &&
    !parts.some((part) => suspiciousExtensions.has(part))
  );
}

function uploadCopy(locale: "en" | "ko") {
  return locale === "ko"
    ? {
        invalidImage: "JPG, PNG, WEBP 파일만 업로드할 수 있습니다.",
        productTooLarge: "5MB 이하 이미지만 업로드해 주세요.",
        profileTooLarge: "2MB 이하 이미지만 업로드해 주세요.",
        generic: "업로드에 실패했습니다. 파일 형식과 용량을 확인해 주세요.",
        network: "네트워크 문제로 업로드하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
        tooMany: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.",
      }
    : {
        invalidImage: "Upload JPG, PNG, or WEBP files only.",
        productTooLarge: "Upload images no larger than 5MB.",
        profileTooLarge: "Upload images no larger than 2MB.",
        generic: "Upload failed. Check the file type and size.",
        network: "Network error while uploading. Check your connection and try again.",
        tooMany: "Too many upload attempts. Please try again shortly.",
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
      setError("이미지는 최대 12장까지 등록할 수 있습니다.");
      return;
    }

    const invalidType = files.some((file) => !isAcceptedImage(file));
    if (invalidType) {
      setError(copy.invalidImage);
      return;
    }
    const oversized = files.some((file) => file.size > maxProductSize);
    if (oversized) {
      setError(copy.productTooLarge);
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
        const result = await uploadImage(file, "product_image", copy);
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
        <span className="text-sm font-semibold text-zinc-900">상품 이미지</span>
        <span className="text-sm text-zinc-500">{items.length}/12</span>
      </div>
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
                대표
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
                삭제
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
                업로드 중
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
            <span className="mt-2">사진 추가</span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp"
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
      <p className="text-xs text-zinc-500">
        첫 번째 사진이 대표 이미지로 사용됩니다. 드래그하거나 화살표로 순서를 변경할 수 있습니다.
      </p>
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
}: {
  kind: Exclude<UploadKind, "product_image">;
  imageUrl?: string;
  label: string;
  circular?: boolean;
  onUploaded: (image: UploadedListingImage) => void;
  onUploadingChange?: (uploading: boolean) => void;
  companyId?: string;
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
    if (!isAcceptedImage(file)) {
      setError(copy.invalidImage);
      return;
    }
    if (file.size > maxProfileSize) {
      setError(copy.profileTooLarge);
      return;
    }

    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    localPreview.current = URL.createObjectURL(file);
    setPreviewUrl(localPreview.current);
    setUploading(true);
    onUploadingChange?.(true);

    const result = await uploadImage(file, kind, copy, { companyId });
    if (result.ok) {
      onUploaded(result.image);
    } else {
      setError(result.error);
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
          <Image
            src={previewUrl}
            alt={`${label} 미리보기`}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-3xl text-zinc-400">
            +
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {uploading ? "업로드 중" : "사진 변경"}
        </span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
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
      {error ? <p className="max-w-xs text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

async function uploadImage(
  file: File,
  uploadType: UploadKind,
  copy: ReturnType<typeof uploadCopy>,
  metadata?: { companyId?: string },
) {
  const formData = new FormData();
  formData.set("uploadType", uploadType);
  formData.set("file", file);
  if (metadata?.companyId) formData.set("companyId", metadata.companyId);

  try {
    const response = await fetch("/api/uploads", {
      method: "POST",
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
