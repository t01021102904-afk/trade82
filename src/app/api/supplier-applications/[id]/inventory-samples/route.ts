import {
  createSignedPrivateFileUrl,
  deleteStorageFile,
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
  uploadSupplierApplicationPrivateFile,
  validateInventorySample,
} from "@/lib/supplier-application-files";
import {
  getSupplierApplicationForApplicant,
  getSupplierApplicationCapabilities,
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
    const samples = await Promise.all(
      application.inventorySamples.map(async (sample) => ({
        id: sample.id,
        format: sample.format,
        originalFilename: sample.originalFilename,
        sizeBytes: sample.sizeBytes,
        totalRows: sample.totalRows,
        validRows: sample.validRows,
        invalidRows: sample.invalidRows,
        duplicateGtins: sample.duplicateGtins,
        validationSummary: sample.validationSummary,
        reviewStatus: sample.reviewStatus,
        createdAt: sample.createdAt,
        signedUrl: await createSignedPrivateFileUrl(sample.storagePath),
      })),
    );
    return Response.json(
      { samples },
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
      scope: "supplier-application-inventory-upload",
      userId: user.id,
      limit: 12,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const application = await getSupplierApplicationForApplicant(
      idParam(id),
      user.id,
    );
    const capabilities = await getSupplierApplicationCapabilities(user.id);
    if (
      capabilities.applicationId !== application.id ||
      !capabilities.canUploadInventorySample
    ) {
      throw new Response(
        "Inventory samples are not requested for this application.",
        { status: 409 },
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new Response("An inventory sample file is required.", {
        status: 400,
      });
    const validated = await validateInventorySample(file);
    const upload = await uploadSupplierApplicationPrivateFile({
      applicationId: application.id,
      kind: "inventory",
      file,
    });
    uploadedPath = upload.path;
    const sample = await getDb().supplierInventorySample.create({
      data: {
        applicationId: application.id,
        format: validated.format,
        originalFilename: file.name,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        mimeType: file.type.toLowerCase(),
        sizeBytes: upload.sizeBytes,
        sha256Hash: upload.sha256Hash,
        totalRows: validated.summary.totalRows,
        validRows: validated.summary.validRows,
        invalidRows: validated.summary.invalidRows,
        duplicateGtins: validated.summary.duplicateGtins,
        validationSummary: validated.summary,
      },
    });
    return Response.json(
      {
        sample: {
          ...sample,
          signedUrl: await createSignedPrivateFileUrl(sample.storagePath),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPath)
      await deleteStorageFile(uploadedPath, "private").catch(() => undefined);
    return apiError(error);
  }
}
