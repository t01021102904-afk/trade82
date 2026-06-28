import { logSafeApiError } from "@/lib/api-response";
import {
  getUserCompany,
  isAdminUser,
  requireAuth,
  requireCompanyOwner,
  requireSeller,
} from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  processMarketplaceImage,
  verifyWebpBuffer,
  type ImageVariantVerification,
} from "@/lib/image-processing";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteStorageFile,
  downloadPublicFileBytes,
  FILE_RULES,
  StorageConfigurationError,
  StorageUploadError,
  StorageValidationError,
  getPublicStorageBucket,
  sanitizeStoredFilename,
  type UploadType,
  uploadPrivateFile,
  uploadPublicFile,
  validateFileSize,
  validateFileType,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

const uploadTypes = new Set<UploadType>([
  "company_logo",
  "product_image",
  "profile_avatar",
  "verification_document",
  "contract_file",
]);

const legacyTypeMap: Record<string, UploadType> = {
  "company-logo": "company_logo",
  "product-image": "product_image",
  "profile-avatar": "profile_avatar",
};

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

function getRequestLocale(request: Request) {
  const explicitLocale = request.headers.get("x-trade82-locale");
  if (explicitLocale === "ko") return "ko";

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function storageRejectedMessage(locale: "en" | "ko") {
  return locale === "ko"
    ? "스토리지 업로드가 실패했습니다. 다시 시도해주세요."
    : "Upload failed because the storage service rejected the file. Please try again.";
}

function storageRejectedDetailMessage(locale: "en" | "ko", detail: string) {
  const base = storageRejectedMessage(locale);
  return detail && detail !== "Storage upload was rejected."
    ? `${base} ${detail}`
    : base;
}

function debugCompanyLogo(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[company-logo] ${message}`, details);
  }
}

function unauthenticatedMessage(locale: "en" | "ko") {
  return locale === "ko"
    ? "로그인 후 업로드할 수 있습니다."
    : "Upload failed because you are not signed in.";
}

function unauthorizedMessage(locale: "en" | "ko") {
  return locale === "ko"
    ? "권한이 없습니다."
    : "You do not have permission to upload this file.";
}

function incompleteCompanyMessage(locale: "en" | "ko") {
  return locale === "ko"
    ? "회사 정보를 먼저 입력한 뒤 업로드해주세요."
    : "Upload failed because your company profile is incomplete.";
}

async function responseMessage(error: Response, locale: "en" | "ko") {
  const text = await error.text().catch(() => "");
  if (
    text.includes("Seller company required") ||
    text.includes("Company role required") ||
    text.includes("Company required")
  ) {
    return incompleteCompanyMessage(locale);
  }
  if (error.status === 401) return unauthenticatedMessage(locale);
  if (error.status === 403) return unauthorizedMessage(locale);
  if (text.trim()) return text.trim();
  if (error.status === 404) return "The upload target was not found.";
  return "Upload request failed.";
}

export async function POST(request: Request) {
  const locale = getRequestLocale(request);
  try {
    const user = await requireAuth();
    const rateLimit = checkRateLimit(`uploads:${user.id}`, 30, 60_000);
    if (!rateLimit.allowed) {
      return jsonError(
        "Too many upload attempts. Please try again shortly.",
        429,
        { "Retry-After": String(rateLimit.retryAfterSeconds) },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawType = String(
      formData.get("uploadType") ?? formData.get("kind") ?? "",
    );
    const uploadType = legacyTypeMap[rawType] ?? rawType;
    if (!(file instanceof File)) {
      return jsonError("Select a file to upload.", 400);
    }
    if (!uploadTypes.has(uploadType as UploadType)) {
      return jsonError("Missing or unsupported upload type.", 400);
    }

    const type = uploadType as UploadType;
    validateFileType(file, type, locale);
    validateFileSize(file, type, locale);

    const authorization = await authorizeUpload({
      type,
      userId: user.id,
      userRole: user.role,
      companyId: String(formData.get("companyId") ?? ""),
      dealId: String(formData.get("dealId") ?? ""),
    });

    if (FILE_RULES[type].visibility === "private") {
      return uploadPrivate({
        type,
        file,
        userId: user.id,
        companyId: authorization.companyId,
        dealId: authorization.dealId,
      });
    }

    return uploadPublic({
      type,
      file,
      ownerId: authorization.ownerId,
      locale,
    });
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof StorageConfigurationError) {
      console.error("Supabase Storage configuration is missing for uploads.");
      return jsonError(
        "Storage is not configured. Check Supabase storage setup.",
        503,
      );
    }
    if (error instanceof StorageUploadError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Supabase Storage upload failed.", {
          message: error.message,
        });
      } else {
        console.error("Supabase Storage upload failed.");
      }
      return jsonError(storageRejectedDetailMessage(locale, error.message), 502);
    }
    if (error instanceof Response) {
      return jsonError(await responseMessage(error, locale), error.status);
    }
    logSafeApiError(error);
    return jsonError(
      locale === "ko"
        ? "업로드에 실패했습니다. 잠시 후 다시 시도해 주세요."
        : "Upload failed. Please try again.",
      500,
    );
  }
}

async function authorizeUpload({
  type,
  userId,
  userRole,
  companyId,
  dealId,
}: {
  type: UploadType;
  userId: string;
  userRole: string;
  companyId: string;
  dealId: string;
}) {
  if (type === "profile_avatar") {
    return { ownerId: userId, companyId: "", dealId: "" };
  }

  if (type === "company_logo") {
    const company = companyId
      ? (await requireCompanyOwner(companyId)).company
      : await getUserCompany(userId);
    if (
      !company &&
      userRole !== "seller" &&
      userRole !== "buyer" &&
      userRole !== "both"
    ) {
      throw new Response("Company role required", { status: 403 });
    }
    if (!company) {
      // Onboarding can upload a draft logo before the Company row exists.
      // The path is scoped to the authenticated user and the final save stores
      // the returned public URL on that user's company only.
      return { ownerId: userId, companyId: "", dealId: "" };
    }
    return { ownerId: company.id, companyId: company.id, dealId: "" };
  }

  if (type === "product_image") {
    const { company } = await requireSeller();
    if (!company) {
      throw new Response("Seller company required", { status: 403 });
    }
    return { ownerId: company.id, companyId: company.id, dealId: "" };
  }

  if (type === "verification_document") {
    if (!companyId) {
      throw new Response("Company required", { status: 400 });
    }
    const { company } = await requireCompanyOwner(companyId);
    if (company.companyRole !== "seller" && company.companyRole !== "buyer") {
      throw new Response("Company role required", { status: 403 });
    }
    return { ownerId: company.id, companyId: company.id, dealId: "" };
  }

  if (!dealId) throw new Response("Deal required", { status: 400 });
  const deal = await getDb().deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Response("Deal not found", { status: 404 });
  const participant = await getDb().company.findFirst({
    where: {
      ownerUserId: userId,
      id: { in: [deal.buyerCompanyId, deal.sellerCompanyId] },
    },
    select: { id: true },
  });
  if (!participant && !(await isAdminUser())) {
    throw new Response("Forbidden", { status: 403 });
  }
  return { ownerId: deal.id, companyId: "", dealId: deal.id };
}

async function uploadPublic({
  type,
  file,
  ownerId,
  locale,
}: {
  type: UploadType;
  file: File;
  ownerId: string;
  locale: "en" | "ko";
}) {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const processed = await processMarketplaceImage(originalBuffer).catch(() => {
    throw new StorageValidationError(
      locale === "ko"
        ? "이미지를 처리할 수 없습니다. 올바른 JPG, PNG, WebP 또는 AVIF 파일을 업로드해주세요."
        : "This image could not be processed. Please upload a valid JPG, PNG, WebP, or AVIF image.",
    );
  });
  const basePath = `${FILE_RULES[type].folder}/${ownerId}/${crypto.randomUUID()}`;
  const paths = {
    original: `${basePath}/original.webp`,
    card: `${basePath}/card-320.webp`,
    main: `${basePath}/main-640.webp`,
    detail: `${basePath}/detail-1280.webp`,
  };
  const variants = [
    { name: "original", path: paths.original, body: processed.original },
    { name: "card", path: paths.card, body: processed.card },
    { name: "main", path: paths.main, body: processed.main },
    { name: "detail", path: paths.detail, body: processed.detail },
  ] as const;
  const uploadedPaths: string[] = [];

  try {
    const results: Array<{
      name: (typeof variants)[number]["name"];
      path: string;
      publicUrl: string;
      generated: ImageVariantVerification;
      uploaded: ImageVariantVerification;
    }> = [];

    for (const variant of variants) {
      const generated = await verifyWebpBuffer(variant.name, variant.body).catch(
        (error) => {
          throw new StorageValidationError(
            error instanceof Error
              ? error.message
              : "Generated image could not be verified before upload.",
          );
        },
      );
      const result = await uploadPublicFile({
        path: variant.path,
        body: variant.body,
        contentType: "image/webp",
      });
      uploadedPaths.push(result.path);

      const downloaded = await downloadPublicFileBytes(result.path);
      const uploaded = await verifyWebpBuffer(
        `${variant.name} uploaded`,
        downloaded,
      ).catch((error) => {
        throw new StorageUploadError(
          error instanceof Error
            ? error.message
            : `Uploaded ${variant.name} image could not be verified.`,
        );
      });

      if (!downloaded.equals(variant.body)) {
        throw new StorageUploadError(
          `Uploaded ${variant.name} image bytes did not match generated bytes (${variant.body.byteLength} generated, ${downloaded.byteLength} stored).`,
        );
      }

      results.push({
        name: variant.name,
        path: result.path,
        publicUrl: result.publicUrl,
        generated,
        uploaded,
      });
    }

    const debug =
      process.env.NODE_ENV !== "production"
        ? {
            generatedImages: results.map((result) => result.generated),
            uploadedImages: results.map((result) => result.uploaded),
          }
        : undefined;

    if (type === "company_logo") {
      debugCompanyLogo("uploaded public company logo", {
        bucket: getPublicStorageBucket(),
        storagePath: basePath,
        originalPath: results[0].path,
        cardPath: results[1].path,
        mainPath: results[2].path,
        detailPath: results[3].path,
        generatedImages: debug?.generatedImages,
        uploadedImages: debug?.uploadedImages,
      });
    }

    return Response.json({
      uploadType: type,
      storagePath: basePath,
      originalUrl: results[0].publicUrl,
      cardUrl: results[1].publicUrl,
      mainUrl: results[2].publicUrl,
      detailUrl: results[3].publicUrl,
      url: type === "product_image" ? results[1].publicUrl : results[2].publicUrl,
      thumbnailUrl: results[1].publicUrl,
      width: processed.width,
      height: processed.height,
      ...(debug ? { debug } : {}),
    });
  } catch (error) {
    await Promise.allSettled(
      uploadedPaths.map((path) => deleteStorageFile(path, "public")),
    );
    throw error;
  }
}

async function uploadPrivate({
  type,
  file,
  userId,
  companyId,
  dealId,
}: {
  type: UploadType;
  file: File;
  userId: string;
  companyId: string;
  dealId: string;
}) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filename = sanitizeStoredFilename(file.name);
  const ownerId = type === "verification_document" ? companyId : dealId;
  const path = `${FILE_RULES[type].folder}/${ownerId}/${crypto.randomUUID()}.${extension}`;
  await uploadPrivateFile({
    path,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  });

  try {
    if (type === "verification_document") {
      const existing = await getDb().verificationRequest.findFirst({
        where: { companyId, status: "pending_review" },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        await getDb().verificationRequest.update({
          where: { id: existing.id },
          data: {
            documentPath: path,
            documentUrl: null,
            documentFilename: filename,
          },
        });
      } else {
        await getDb().verificationRequest.create({
          data: {
            companyId,
            requestedByUserId: userId,
            status: "pending_review",
            documentPath: path,
            documentFilename: filename,
          },
        });
      }
      await getDb().company.update({
        where: { id: companyId },
        data: { verificationStatus: "pending_review" },
      });
    } else {
      await getDb().deal.update({
        where: { id: dealId },
        data: {
          contractFilePath: path,
          contractFileName: filename,
        },
      });
    }
  } catch (error) {
    await deleteStorageFile(path, "private").catch(() => undefined);
    throw error;
  }

  return Response.json({
    uploadType: type,
    path,
    filename,
  });
}
