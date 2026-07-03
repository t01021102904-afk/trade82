import type {
  DocumentCategory,
  DocumentVisibilityStatus,
} from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { rateLimitOrResponse } from "@/lib/api-security";
import { requireSeller } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  buildTradeDocumentFilename,
  buildTradeDocumentStoragePath,
  deleteTradeDocumentFile,
  DocumentStorageValidationError,
  getDocumentStorageBucket,
  uploadTradeDocumentFile,
  validateTradeDocumentFile,
} from "@/lib/document-storage";
import {
  StorageConfigurationError,
  StorageUploadError,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

const documentCategories: DocumentCategory[] = [
  "company",
  "product",
  "compliance",
  "shipping",
  "contracts",
  "shared_with_buyer",
];
const visibilityStatuses: DocumentVisibilityStatus[] = [
  "private",
  "internal_review",
  "shared_with_buyer",
];

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

function parseCategory(value: FormDataEntryValue | null): DocumentCategory {
  if (typeof value !== "string" || !documentCategories.includes(value as DocumentCategory)) {
    throw new DocumentStorageValidationError("Document category is invalid.");
  }
  return value as DocumentCategory;
}

function parseVisibility(value: FormDataEntryValue | null): DocumentVisibilityStatus {
  if (!value) return "private";
  if (typeof value !== "string" || !visibilityStatuses.includes(value as DocumentVisibilityStatus)) {
    throw new DocumentStorageValidationError("Document visibility is invalid.");
  }
  return value as DocumentVisibilityStatus;
}

function normalizeDocumentType(extension: string) {
  if (extension === "jpeg") return "JPG";
  return extension.toUpperCase();
}

async function documentPayload(companyId: string) {
  const db = getDb();
  const [folders, documents] = await Promise.all([
    db.documentFolder.findMany({
      where: { companyId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    }),
    db.tradeDocument.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: { folder: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      category: folder.category,
      files: folder._count.documents,
      updatedAt: folder.updatedAt.toISOString(),
    })),
    documents: documents.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      category: document.category,
      folderId: document.folderId,
      folderName: document.folder?.name ?? null,
      visibilityStatus: document.visibilityStatus,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  try {
    const { company } = await requireSeller();
    if (!company) {
      return Response.json({ folders: [], documents: [], companyRequired: true });
    }

    return Response.json(await documentPayload(company.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, company } = await requireSeller();
    if (!company) {
      return jsonError("Create a company profile before uploading documents.", 403);
    }

    const rateLimited = rateLimitOrResponse({
      request,
      scope: "trade-document-upload",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
      message: "Too many document uploads. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("Select a document to upload.", 400);
    }

    const category = parseCategory(formData.get("category"));
    const visibilityStatus = parseVisibility(formData.get("visibilityStatus"));
    const rawFolderId = formData.get("folderId");
    const folderId = typeof rawFolderId === "string" && rawFolderId.trim()
      ? rawFolderId.trim()
      : null;

    if (folderId) {
      const folder = await getDb().documentFolder.findFirst({
        where: { id: folderId, companyId: company.id, category },
        select: { id: true },
      });
      if (!folder) return jsonError("Document folder was not found.", 400);
    }

    const { extension, mimeType } = validateTradeDocumentFile(file);
    const storedFilename = buildTradeDocumentFilename(file, extension);
    const storagePath = buildTradeDocumentStoragePath({
      companyId: company.id,
      category,
      filename: storedFilename,
    });
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadTradeDocumentFile({
      path: storagePath,
      body: buffer,
      contentType: mimeType,
    });

    try {
      const bucket = getDocumentStorageBucket();
      await getDb().tradeDocument.create({
        data: {
          companyId: company.id,
          uploadedByUserId: user.id,
          fileName: file.name.slice(0, 255),
          fileUrl: `supabase://${bucket}/${storagePath}`,
          fileType: normalizeDocumentType(extension),
          fileSize: file.size,
          storageBucket: bucket,
          storagePath,
          mimeType,
          category,
          folderId,
          visibilityStatus,
        },
      });
    } catch (error) {
      await deleteTradeDocumentFile(storagePath).catch(() => undefined);
      throw error;
    }

    return Response.json(await documentPayload(company.id), { status: 201 });
  } catch (error) {
    if (error instanceof DocumentStorageValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof StorageConfigurationError) {
      return jsonError(error.message, 500);
    }
    if (error instanceof StorageUploadError) {
      return jsonError(error.message, 502);
    }
    return apiError(error);
  }
}
