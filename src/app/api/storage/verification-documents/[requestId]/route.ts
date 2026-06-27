import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createSignedPrivateFileUrl } from "@/lib/supabase-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    await requireAdmin();
    const { requestId: rawRequestId } = await params;
    const requestId = idParam(rawRequestId, "requestId");
    const verification = await getDb().verificationRequest.findUnique({
      where: { id: requestId },
      select: { documentPath: true, documentFilename: true },
    });
    if (!verification?.documentPath) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }
    return Response.json({
      signedUrl: await createSignedPrivateFileUrl(verification.documentPath),
      filename: verification.documentFilename,
      expiresIn: 300,
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
