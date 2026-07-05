"use client";

import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  file?: File;
};

type ProductEditorMode = "fit" | "fill";

type ProductImageEditorState = {
  offsetX: number;
  offsetY: number;
  zoom: number;
  rotation: number;
  mode: ProductEditorMode;
};

type ProductImageEditorFile = {
  id: string;
  file: File;
  previewUrl: string;
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
const productEditorOutputSize = 1600;
const productEditorPreviewSize = 900;
const productEditorQuality = 0.9;
const defaultEditorState: ProductImageEditorState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  rotation: 0,
  mode: "fit",
};

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
        profileHelp:
          "JPG, PNG, WebP, AVIF 파일을 업로드할 수 있습니다. 프로필 사진과 회사 로고는 최대 25MB까지 가능합니다.",
        tooManyImages: "이미지는 최대 12장까지 등록할 수 있습니다.",
        primary: "대표",
        remove: "삭제",
        uploading: "업로드 중",
        addPhoto: "사진 추가",
        changePhoto: "사진 변경",
        retryUpload: "다시 시도",
        dragHelp: "이미지를 끌어오거나 파일을 선택하세요",
        adjustImage: "이미지 조정",
        zoom: "확대/축소",
        rotateLeft: "왼쪽 회전",
        rotateRight: "오른쪽 회전",
        fitFullImage: "전체 맞춤",
        fillFrame: "프레임 채우기",
        reset: "초기화",
        cancel: "취소",
        apply: "적용",
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
        profileHelp:
          "Upload JPG, PNG, WebP, or AVIF. Profile photos and company logos can be up to 25MB.",
        tooManyImages: "You can add up to 12 images.",
        primary: "Primary",
        remove: "Remove",
        uploading: "Uploading",
        addPhoto: "Add photo",
        changePhoto: "Change photo",
        retryUpload: "Retry",
        dragHelp: "Drag images here or choose files",
        adjustImage: "Adjust image",
        zoom: "Zoom",
        rotateLeft: "Rotate left",
        rotateRight: "Rotate right",
        fitFullImage: "Fit full image",
        fillFrame: "Fill frame",
        reset: "Reset",
        cancel: "Cancel",
        apply: "Apply",
      };
}

function debugImageUpload(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[image-uploader] ${message}`, details);
  }
}

function updateUploadedProductPreview(
  item: PendingImage,
  result:
    | { ok: true; image: UploadedListingImage }
    | { ok: false; error: string },
  previewUrls: Set<string>,
): PendingImage {
  if (!result.ok) {
    return {
      ...item,
      status: "error",
      error: result.error,
    };
  }

  if (previewUrls.has(item.previewUrl)) {
    URL.revokeObjectURL(item.previewUrl);
    previewUrls.delete(item.previewUrl);
  }

  return {
    ...item,
    previewUrl:
      result.image.cardUrl || result.image.mainUrl || result.image.originalUrl,
    uploaded: result.image,
    status: "ready",
    error: "",
  };
}

function normalizedRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

function rotatedImageBounds(image: HTMLImageElement, rotation: number) {
  const normalized = normalizedRotation(rotation);
  const sideways = normalized === 90 || normalized === 270;
  return {
    width: sideways ? image.naturalHeight : image.naturalWidth,
    height: sideways ? image.naturalWidth : image.naturalHeight,
  };
}

function imageScaleForFrame(
  image: HTMLImageElement,
  state: ProductImageEditorState,
  targetSize: number,
) {
  const bounds = rotatedImageBounds(image, state.rotation);
  const fitScale = targetSize / Math.max(bounds.width, bounds.height);
  const fillScale = targetSize / Math.min(bounds.width, bounds.height);
  return (state.mode === "fill" ? fillScale : fitScale) * state.zoom;
}

function drawProductEditorCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  state: ProductImageEditorState,
  targetSize: number,
) {
  canvas.width = targetSize;
  canvas.height = targetSize;

  const context = canvas.getContext("2d");
  if (!context) return;

  const scaleRatio = targetSize / productEditorOutputSize;
  const imageScale = imageScaleForFrame(image, state, targetSize);

  context.clearRect(0, 0, targetSize, targetSize);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetSize, targetSize);
  context.save();
  context.translate(
    targetSize / 2 + state.offsetX * scaleRatio,
    targetSize / 2 + state.offsetY * scaleRatio,
  );
  context.rotate((normalizedRotation(state.rotation) * Math.PI) / 180);
  context.scale(imageScale, imageScale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.restore();
}

function editedImageFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "product-image";
  return `${baseName}-edited.jpg`;
}

function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to generate edited image."));
          return;
        }
        resolve(
          new File([blob], editedImageFileName(fileName), {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        );
      },
      "image/jpeg",
      productEditorQuality,
    );
  });
}

export function ListingImageUploader({
  value,
  onChange,
  onUploadingChange,
  variant = "default",
}: {
  value: UploadedListingImage[];
  onChange: (images: UploadedListingImage[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  variant?: "default" | "dashboard";
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
  const [editorFile, setEditorFile] = useState<ProductImageEditorFile | null>(null);
  const [editorQueue, setEditorQueue] = useState<File[]>([]);
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

  useEffect(() => {
    return () => {
      if (editorFile?.previewUrl) URL.revokeObjectURL(editorFile.previewUrl);
    };
  }, [editorFile]);

  function openEditor(file: File) {
    setEditorFile({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function closeEditorAndOpenNext() {
    setEditorFile(null);
    setEditorQueue((current) => {
      const [nextFile, ...remaining] = current;
      if (nextFile) {
        queueMicrotask(() => openEditor(nextFile));
      }
      return remaining;
    });
  }

  async function addFiles(files: File[]) {
    setError("");
    const pendingEditorCount = editorQueue.length + (editorFile ? 1 : 0);
    if (items.length + pendingEditorCount + files.length > 12) {
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

    const [firstFile, ...remainingFiles] = files;
    if (!firstFile) return;
    if (editorFile) {
      setEditorQueue((current) => [...current, ...files]);
      return;
    }
    openEditor(firstFile);
    if (remainingFiles.length) {
      setEditorQueue((current) => [...current, ...remainingFiles]);
    }
  }

  async function uploadEditedProductImage(file: File) {
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    const addition: PendingImage = {
      id: crypto.randomUUID(),
      previewUrl,
      fileName: file.name,
      uploaded: null,
      status: "uploading",
      error: "",
      file,
    };
    setItems((current) => [
      ...current,
      addition,
    ]);

    const result = await uploadImage(file, "product_image", copy, {
      locale,
    });
    setItems((current) =>
      current.map((item) =>
        item.id === addition.id
          ? updateUploadedProductPreview(item, result, previewUrls.current)
          : item,
      ),
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
      if (removed && previewUrls.current.has(removed.previewUrl)) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  async function retry(id: string) {
    const retryItem = items.find((item) => item.id === id);
    if (!retryItem?.file) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "uploading", error: "" } : item,
      ),
    );
    const result = await uploadImage(retryItem.file, "product_image", copy, {
      locale,
    });
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? updateUploadedProductPreview(item, result, previewUrls.current)
          : item,
      ),
    );
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
      {editorFile ? (
        <ProductImageEditorModal
          key={editorFile.id}
          editorFile={editorFile}
          copy={copy}
          onCancel={closeEditorAndOpenNext}
          onApply={(file) => {
            void uploadEditedProductImage(file);
            closeEditorAndOpenNext();
          }}
        />
      ) : null}
      <div
        className={cx(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
          variant === "dashboard" &&
            "lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
        )}
      >
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
            className={cx(
              "relative aspect-square overflow-hidden rounded-md border bg-zinc-100",
              variant === "dashboard"
                ? "rounded-2xl border-white/10 bg-zinc-950"
                : "border-zinc-200",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={`${item.fileName} 미리보기`}
              className="absolute inset-0 size-full bg-white object-contain"
            />
            {index === 0 ? (
              <span
                className={cx(
                  "absolute left-2 top-2 rounded px-2 py-1 text-xs font-medium",
                  variant === "dashboard"
                    ? "bg-emerald-400 text-zinc-950"
                    : "bg-zinc-950 text-white",
                )}
              >
                {copy.primary}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/65 p-1.5">
              <button
                type="button"
                onClick={() => move(item.id, -1)}
                disabled={index === 0}
                className="size-8 rounded-lg bg-white/90 text-sm text-zinc-900 disabled:opacity-40"
                aria-label="이미지를 앞으로 이동"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="h-8 rounded-lg bg-white/90 px-2 text-xs font-medium text-red-700"
              >
                {copy.remove}
              </button>
              <button
                type="button"
                onClick={() => move(item.id, 1)}
                disabled={index === items.length - 1}
                className="size-8 rounded-lg bg-white/90 text-sm text-zinc-900 disabled:opacity-40"
                aria-label="이미지를 뒤로 이동"
              >
                →
              </button>
            </div>
            {item.status === "uploading" ? (
              <span
                className={cx(
                  "absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium",
                  variant === "dashboard"
                    ? "bg-zinc-950/75 text-zinc-100"
                    : "bg-white/75 text-zinc-700",
                )}
              >
                <span className="size-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>{copy.uploading}</span>
              </span>
            ) : null}
            {item.status === "error" ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50/95 p-3 text-center text-xs text-red-700">
                <span>{item.error}</span>
                {item.file ? (
                  <button
                    type="button"
                    onClick={() => void retry(item.id)}
                    className="h-8 rounded-md border border-red-200 bg-white px-2 text-xs font-medium text-red-700"
                  >
                    {copy.retryUpload}
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        ))}
        {items.length < 12 ? (
          <label
            className={cx(
              "flex aspect-square min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-sm font-medium transition",
              variant === "dashboard"
                ? "rounded-2xl border-white/15 bg-zinc-950/70 text-zinc-400 hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-200"
                : "border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700",
            )}
          >
            <span className="text-2xl leading-none">+</span>
            <span className="mt-2">{copy.addPhoto}</span>
            {variant === "dashboard" ? (
              <span className="mt-1 px-4 text-center text-[11px] font-normal leading-4 text-zinc-500">
                {copy.dragHelp}
              </span>
            ) : null}
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
      {error ? (
        <p className={cx("text-sm", variant === "dashboard" ? "text-red-300" : "text-red-700")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProductImageEditorModal({
  editorFile,
  copy,
  onCancel,
  onApply,
}: {
  editorFile: ProductImageEditorFile;
  copy: ReturnType<typeof uploadCopy>;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [state, setState] = useState<ProductImageEditorState>(defaultEditorState);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const nextImage = new Image();
    nextImage.decoding = "async";
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = editorFile.previewUrl;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [editorFile.previewUrl]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    drawProductEditorCanvas(
      canvasRef.current,
      image,
      state,
      productEditorPreviewSize,
    );
  }, [image, state]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function setMode(mode: ProductEditorMode) {
    setState({
      ...defaultEditorState,
      mode,
    });
  }

  function rotate(delta: number) {
    setState((current) => ({
      ...current,
      offsetX: 0,
      offsetY: 0,
      rotation: normalizedRotation(current.rotation + delta),
    }));
  }

  function reset() {
    setState(defaultEditorState);
  }

  async function applyEdit() {
    if (!image || applying) return;
    setApplying(true);
    try {
      const outputCanvas = document.createElement("canvas");
      drawProductEditorCanvas(
        outputCanvas,
        image,
        state,
        productEditorOutputSize,
      );
      const editedFile = await canvasToJpegFile(outputCanvas, editorFile.file.name);
      onApply(editedFile);
    } finally {
      setApplying(false);
    }
  }

  function dragScale(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return productEditorOutputSize / Math.max(rect.width, 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/25 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={copy.adjustImage}
    >
      <div className="grid max-h-[92vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-2xl border bg-white p-4 shadow-2xl shadow-zinc-950/20 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-950">
              {copy.adjustImage}
            </h2>
            <p className="mt-1 truncate text-sm text-zinc-500">
              {editorFile.file.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("fit")}
              className={cx(
                editorModeButtonClass,
                state.mode === "fit"
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {copy.fitFullImage}
            </button>
            <button
              type="button"
              onClick={() => setMode("fill")}
              className={cx(
                editorModeButtonClass,
                state.mode === "fill"
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {copy.fillFrame}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="rounded-2xl border bg-zinc-50 p-3">
            <canvas
              ref={canvasRef}
              className="aspect-square w-full touch-none rounded-xl border border-zinc-200 bg-white shadow-sm"
              onPointerDown={(event) => {
                if (!image) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  startOffsetX: state.offsetX,
                  startOffsetY: state.offsetY,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const scale = dragScale(event);
                const nextOffsetX =
                  drag.startOffsetX + (event.clientX - drag.startX) * scale;
                const nextOffsetY =
                  drag.startOffsetY + (event.clientY - drag.startY) * scale;
                setState((current) => ({
                  ...current,
                  offsetX: nextOffsetX,
                  offsetY: nextOffsetY,
                }));
              }}
              onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId) {
                  dragRef.current = null;
                }
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
            />
          </div>

          <div className="grid content-start gap-3">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              <span>{copy.zoom}</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={state.zoom}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    zoom: Number(event.target.value),
                  }))
                }
                className="accent-zinc-950"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => rotate(-90)}
                className={editorControlButtonClass}
              >
                {copy.rotateLeft}
              </button>
              <button
                type="button"
                onClick={() => rotate(90)}
                className={editorControlButtonClass}
              >
                {copy.rotateRight}
              </button>
            </div>
            <button
              type="button"
              onClick={reset}
              className={editorControlButtonClass}
            >
              {copy.reset}
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={() => void applyEdit()}
            disabled={!image || applying}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
          >
            {applying ? copy.uploading : copy.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

const editorModeButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition";
const editorControlButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50";

export function SingleImageUploader({
  kind,
  imageUrl,
  imageUrls,
  label,
  circular = true,
  onUploaded,
  onUploadingChange,
  companyId,
  onUploadError,
}: {
  kind: Exclude<UploadKind, "product_image">;
  imageUrl?: string;
  imageUrls?: string[];
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
  const lastValidPreviewUrl = useRef(imageUrl?.trim() ?? "");
  const failedPreviewUrls = useRef<Set<string>>(new Set());
  const previewFailureCounts = useRef<Map<string, number>>(new Map());
  const savedPreviewKey = (imageUrls?.length ? imageUrls : [imageUrl])
    .map((url) => url?.trim() ?? "")
    .join("\n");
  const savedPreviewKeyRef = useRef(savedPreviewKey);
  const savedPreviewUrls = useMemo(
    () =>
      Array.from(
        new Set(
          savedPreviewKey
            .split("\n")
            .map((url) => url?.trim())
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [savedPreviewKey],
  );

  useEffect(() => {
    if (savedPreviewKeyRef.current !== savedPreviewKey) {
      savedPreviewKeyRef.current = savedPreviewKey;
      failedPreviewUrls.current.clear();
      previewFailureCounts.current.clear();
    }
    const nextSavedPreviewUrl =
      savedPreviewUrls.find((url) => !failedPreviewUrls.current.has(url)) ?? "";
    if (nextSavedPreviewUrl) {
      lastValidPreviewUrl.current = nextSavedPreviewUrl;
    }
    debugImageUpload("SingleImageUploader props", {
      kind,
      imageUrl: imageUrl ?? "",
      savedPreviewUrls,
      hasLocalPreview: Boolean(localPreview.current),
      lastValidPreviewUrl: lastValidPreviewUrl.current,
    });
    if (!localPreview.current && nextSavedPreviewUrl) {
      setPreviewUrl((current) => {
        if (current && !failedPreviewUrls.current.has(current)) return current;
        return current === nextSavedPreviewUrl ? current : nextSavedPreviewUrl;
      });
    }
  }, [imageUrl, kind, savedPreviewKey, savedPreviewUrls]);

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
    failedPreviewUrls.current.clear();
    previewFailureCounts.current.clear();
    localPreview.current = URL.createObjectURL(file);
    setPreviewUrl(localPreview.current);
    setUploading(true);
    onUploadingChange?.(true);

    const result = await uploadImage(file, kind, copy, { companyId, locale });
    if (result.ok) {
      const uploadedPreviewUrl =
        result.image.mainUrl || result.image.cardUrl || result.image.originalUrl;
      debugImageUpload("upload response body", {
        kind,
        storagePath: result.image.storagePath,
        originalUrl: result.image.originalUrl,
        cardUrl: result.image.cardUrl,
        mainUrl: result.image.mainUrl,
        detailUrl: result.image.detailUrl,
        uploadedPreviewUrl,
      });
      if (localPreview.current) {
        URL.revokeObjectURL(localPreview.current);
        localPreview.current = "";
      }
      lastValidPreviewUrl.current = uploadedPreviewUrl;
      failedPreviewUrls.current.clear();
      previewFailureCounts.current.clear();
      setPreviewUrl((current) =>
        current === uploadedPreviewUrl ? current : uploadedPreviewUrl,
      );
      onUploaded(result.image);
    } else {
      if (localPreview.current) {
        URL.revokeObjectURL(localPreview.current);
        localPreview.current = "";
      }
      const fallbackPreviewUrl =
        savedPreviewUrls.find((url) => !failedPreviewUrls.current.has(url)) ??
        (lastValidPreviewUrl.current &&
        !failedPreviewUrls.current.has(lastValidPreviewUrl.current)
          ? lastValidPreviewUrl.current
          : "");
      setPreviewUrl((current) =>
        current === fallbackPreviewUrl ? current : fallbackPreviewUrl,
      );
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
              const failedUrl = previewUrl.trim();
              if (!failedUrl) return;
              const failureCount =
                (previewFailureCounts.current.get(failedUrl) ?? 0) + 1;
              previewFailureCounts.current.set(failedUrl, failureCount);
              failedPreviewUrls.current.add(failedUrl);

              if (localPreview.current) {
                URL.revokeObjectURL(localPreview.current);
                localPreview.current = "";
              }

              if (lastValidPreviewUrl.current === failedUrl) {
                lastValidPreviewUrl.current = "";
              }

              const nextPreviewUrl =
                savedPreviewUrls.find(
                  (url) => url !== failedUrl && !failedPreviewUrls.current.has(url),
                ) ??
                (lastValidPreviewUrl.current &&
                lastValidPreviewUrl.current !== failedUrl &&
                !failedPreviewUrls.current.has(lastValidPreviewUrl.current)
                  ? lastValidPreviewUrl.current
                  : "");

              debugImageUpload("preview image failed", {
                kind,
                failedUrl,
                failureCount,
                nextPreviewUrl,
              });

              setPreviewUrl((current) => {
                if (current !== failedUrl) return current;
                return nextPreviewUrl;
              });
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
