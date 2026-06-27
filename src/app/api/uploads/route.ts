import { logSafeApiError } from "@/lib/api-response";
import {
  getUserCompany,
  isAdminUser,
  requireAuth,
  requireCompanyOwner,
  requireSeller,
} from "@/lib/authz";
import { getDb } from "@/lib/db";
import { processMarketplaceImage } from "@/lib/image-processing";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteStorageFile,
  FILE_RULES,
  StorageConfigurationError,
  StorageUploadError,
  StorageValidationError,
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

async function responseMessage(error: Response) {
  const text = await error.text().catch(() => "");
  if (text.trim()) return text.trim();
  if (error.status === 401) return "Login is required.";
  if (error.status === 403) return "You do not have permission to upload this file.";
  if (error.status === 404) return "The upload target was not found.";
  return "Upload request failed.";
}

export async function POST(request: Request) {
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
    validateFileType(file, type);
    validateFileSize(file, type);

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

    return uploadPublic({ type, file, ownerId: authorization.ownerId });
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
      console.error("Supabase Storage upload failed.");
      return jsonError(error.message, 502);
    }
    if (error instanceof Response) {
      return jsonError(await responseMessage(error), error.status);
    }
    logSafeApiError(error);
    return jsonError("Upload failed. Check the file type and size.", 500);
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
}: {
  type: UploadType;
  file: File;
  ownerId: string;
}) {
  const processed = await processMarketplaceImage(
    Buffer.from(await file.arrayBuffer()),
  );
  const basePath = `${FILE_RULES[type].folder}/${ownerId}/${crypto.randomUUID()}`;
  const paths = {
    original: `${basePath}/original.webp`,
    card: `${basePath}/card-320.webp`,
    main: `${basePath}/main-640.webp`,
    detail: `${basePath}/detail-1280.webp`,
  };
  const uploadedPaths: string[] = [];

  try {
    const results = await Promise.all(
      [
        [paths.original, processed.original],
        [paths.card, processed.card],
        [paths.main, processed.main],
        [paths.detail, processed.detail],
      ].map(async ([path, body]) => {
        const result = await uploadPublicFile({
          path: path as string,
          body: body as Buffer,
          contentType: "image/webp",
        });
        uploadedPaths.push(result.path);
        return result;
      }),
    );

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
