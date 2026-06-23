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
  StorageValidationError,
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

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const rateLimit = checkRateLimit(`uploads:${user.id}`, 30, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "업로드 요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawType = String(
      formData.get("uploadType") ?? formData.get("kind") ?? "",
    );
    const uploadType = legacyTypeMap[rawType] ?? rawType;
    if (!(file instanceof File)) {
      return Response.json(
        { error: "업로드할 파일을 선택해 주세요." },
        { status: 400 },
      );
    }
    if (!uploadTypes.has(uploadType as UploadType)) {
      return Response.json(
        { error: "지원하지 않는 업로드 형식이에요." },
        { status: 400 },
      );
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
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Response) {
      return Response.json(
        { error: error.statusText || "Request failed" },
        { status: error.status },
      );
    }
    if (
      error instanceof Error &&
      error.message === "Supabase Storage is not configured."
    ) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error(error);
    return Response.json(
      { error: "파일을 업로드하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
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
    if (company.companyRole !== "seller") {
      throw new Response("Seller company required", { status: 403 });
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
            documentFilename: file.name.slice(0, 255),
          },
        });
      } else {
        await getDb().verificationRequest.create({
          data: {
            companyId,
            requestedByUserId: userId,
            status: "pending_review",
            documentPath: path,
            documentFilename: file.name.slice(0, 255),
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
          contractFileName: file.name.slice(0, 255),
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
    filename: file.name.slice(0, 255),
  });
}
