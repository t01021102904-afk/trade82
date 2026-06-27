import { apiError, logSafeApiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idField,
  rateLimitOrResponse,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  buildMessageAttachmentStoragePath,
  buildStoredAttachmentFilename,
  getInquiryParticipant,
  MessageAttachmentValidationError,
  sha256Hex,
  validateMessageAttachmentFile,
} from "@/lib/message-attachments";
import {
  deleteStorageFile,
  getPrivateStorageBucket,
  uploadPrivateFile,
} from "@/lib/supabase-storage";

export const runtime = "nodejs";

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "message-attachment-upload",
      userId: user.id,
      limit: 50,
      windowMs: 60 * 60_000,
      message: "Too many attachment uploads. Please wait before trying again.",
    });
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const file = formData.get("file");
    const body = { inquiryId: formData.get("inquiryId") };
    const inquiryId = idField(body, "inquiryId", { required: true });
    if (!inquiryId) throw validationError("inquiryId is required.");
    if (!(file instanceof File)) {
      return jsonError("Select a PDF or image file to attach.", 400);
    }

    const participant = await getInquiryParticipant({
      inquiryId,
      userId: user.id,
    });
    if (!participant?.company) {
      return jsonError("You do not have permission to attach files to this conversation.", 403);
    }

    const { extension, fileType } = validateMessageAttachmentFile(file);
    const storedFilename = buildStoredAttachmentFilename(file, extension);
    const storagePath = buildMessageAttachmentStoragePath({
      inquiryId,
      fileType,
      storedFilename,
    });
    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256Hash = sha256Hex(buffer);

    await uploadPrivateFile({
      path: storagePath,
      body: buffer,
      contentType: file.type,
    });

    try {
      const attachment = await getDb().messageAttachment.create({
        data: {
          inquiryId,
          uploadedByUserId: user.id,
          uploadedByCompanyId: participant.company.id,
          originalFilename: file.name.slice(0, 255),
          storedFilename,
          storageBucket: getPrivateStorageBucket(),
          storagePath,
          mimeType: file.type,
          fileType,
          sizeBytes: file.size,
          sha256Hash,
          status: "restricted",
        },
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          fileType: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
        },
      });

      return Response.json(attachment, { status: 201 });
    } catch (error) {
      await deleteStorageFile(storagePath, "private").catch(() => undefined);
      logSafeApiError(error);
      return jsonError("Attachment uploaded but could not be linked. Please try again.", 500);
    }
  } catch (error) {
    if (error instanceof MessageAttachmentValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
