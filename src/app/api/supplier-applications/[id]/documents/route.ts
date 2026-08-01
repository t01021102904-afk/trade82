import {
  createSignedPrivateFileUrl,
  deleteStorageFile,
  validateFileSize,
  validateFileType,
} from "@/lib/supabase-storage";
import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  parseSupplierApplicationDocumentType,
  uploadSupplierApplicationPrivateFile,
} from "@/lib/supplier-application-files";
import {
  getSupplierApplicationForApplicant,
  canEditSupplierApplication,
} from "@/lib/supplier-application";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const application = await getSupplierApplicationForApplicant(
      idParam(id),
      user.id,
    );
    const documents = await Promise.all(
      application.documents.map(async (document) => ({
        id: document.id,
        documentType: document.documentType,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        reviewStatus: document.reviewStatus,
        createdAt: document.createdAt,
        signedUrl: await createSignedPrivateFileUrl(document.storagePath),
      })),
    );
    return Response.json(
      { documents },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let uploadedPath: string | null = null;
  try {
    assertSameOrigin(request);
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "supplier-application-document-upload",
      userId: user.id,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const application = await getSupplierApplicationForApplicant(
      idParam(id),
      user.id,
    );
    if (!canEditSupplierApplication(application.status))
      throw new Response("This supplier application is read-only.", {
        status: 409,
      });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new Response("A document file is required.", { status: 400 });
    validateFileType(file, "supplier_application_document");
    validateFileSize(file, "supplier_application_document");
    const upload = await uploadSupplierApplicationPrivateFile({
      applicationId: application.id,
      kind: "documents",
      file,
    });
    uploadedPath = upload.path;
    const document = await getDb().supplierApplicationDocument.create({
      data: {
        applicationId: application.id,
        uploadedByUserId: user.id,
        documentType: parseSupplierApplicationDocumentType(
          form.get("documentType"),
        ),
        originalFilename: file.name,
        storedFilename: upload.storedFilename,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        mimeType: file.type.toLowerCase(),
        sizeBytes: upload.sizeBytes,
        sha256Hash: upload.sha256Hash,
      },
    });
    return Response.json(
      {
        document: {
          ...document,
          signedUrl: await createSignedPrivateFileUrl(document.storagePath),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPath) {
      await deleteStorageFile(uploadedPath, "private").catch(() => undefined);
    }
    return apiError(error);
  }
}
