import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { getInquiryParticipant } from "@/lib/message-attachments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: rawId } = await params;
    const inquiryId = idParam(rawId, "inquiryId");
    const participant = await getInquiryParticipant({
      inquiryId,
      userId: user.id,
      allowAdmin: true,
    });
    if (!participant) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const attachments = await getDb().messageAttachment.findMany({
      where: {
        inquiryId,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedByUser: {
          select: { displayName: true },
        },
        uploadedByCompany: {
          select: { legalName: true, tradeName: true },
        },
        message: {
          select: { id: true, createdAt: true },
        },
      },
    });

    return Response.json(attachments);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
