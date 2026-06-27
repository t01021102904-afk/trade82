import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getInquiryParticipant } from "@/lib/message-attachments";
import { MESSAGE_ATTACHMENT_LIMITS } from "@/lib/message-attachment-rules";
import { createSignedPrivateFileUrl } from "@/lib/supabase-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: rawId } = await params;
    const id = idParam(rawId, "attachmentId");
    const attachment = await getDb().messageAttachment.findUnique({
      where: { id },
      include: { inquiry: true },
    });
    if (!attachment) return Response.json({ error: "Not found." }, { status: 404 });

    const participant = await getInquiryParticipant({
      inquiryId: attachment.inquiryId,
      userId: user.id,
      allowAdmin: true,
    });
    if (!participant) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    if (
      attachment.status !== "active" &&
      !participant.isAdmin &&
      attachment.uploadedByUserId !== user.id
    ) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const signedUrl = await createSignedPrivateFileUrl(
      attachment.storagePath,
      MESSAGE_ATTACHMENT_LIMITS.signedUrlExpiresInSeconds,
    );

    return Response.json({
      signedUrl,
      expiresInSeconds: MESSAGE_ATTACHMENT_LIMITS.signedUrlExpiresInSeconds,
      filename: attachment.originalFilename,
      mimeType: attachment.mimeType,
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
