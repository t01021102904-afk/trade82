import { after } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  stringArrayField,
  stringField,
  validationError,
  validationErrorResponse,
} from "@/lib/api-security";
import { isAdminUser } from "@/lib/authz";
import { requireCurrentAppUser } from "@/lib/current-app-user";
import { getDb } from "@/lib/db";
import { sendNewMessageNotification } from "@/lib/message-email-notifications";
import { getInquiryParticipant } from "@/lib/message-attachments";
import { sha256Hex } from "@/lib/message-attachments";
import { MESSAGE_ATTACHMENT_LIMITS } from "@/lib/message-attachment-rules";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const { id: rawId } = await params;
    const inquiryId = idParam(rawId, "inquiryId");
    const participant = await getInquiryParticipant({
      inquiryId,
      userId: user.id,
      allowAdmin: true,
    });
    if (!participant) return Response.json({ error: "Not found" }, { status: 404 });

    const afterId = new URL(request.url).searchParams.get("after")?.trim();
    const afterMessage = afterId
      ? await getDb().message.findFirst({
          where: { id: afterId, inquiryId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (afterId && !afterMessage) {
      return Response.json({ error: "Message cursor was not found." }, { status: 404 });
    }
    const messages = await getDb().message.findMany({
      where: {
        inquiryId,
        ...(afterMessage
          ? {
              OR: [
                { createdAt: { gt: afterMessage.createdAt } },
                { createdAt: afterMessage.createdAt, id: { gt: afterMessage.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 50,
      include: {
        attachments: {
          where: { status: "active" },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return Response.json(
      { messages },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentAppUser();
    const admin = await isAdminUser();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "messages",
      userId: user.id,
      limit: 60,
      windowMs: 60 * 60_000,
      message: "Too many messages. Please wait before sending more.",
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "inquiryId");
    const inquiry = await getDb().inquiry.findFirst({
      where: {
        id,
        buyerCompany: { deletedAt: null },
        sellerCompany: { deletedAt: null },
        recipientCompany: { deletedAt: null },
        OR: [
          { senderUserId: user.id },
          { recipientCompany: { ownerUserId: user.id, deletedAt: null } },
          ...(admin
            ? [
                {
                  buyerCompany: {
                    deletedAt: null,
                    OR: [{ legalName: "Trade82 team" }, { tradeName: "Trade82 team" }],
                  },
                },
                {
                  sellerCompany: {
                    deletedAt: null,
                    OR: [{ legalName: "Trade82 team" }, { tradeName: "Trade82 team" }],
                  },
                },
              ]
            : []),
        ],
      },
    });
    if (!inquiry) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const body = await readJsonObject(request);
    const messageBody = stringField(body, "body", {
      max: 2_000,
      fallback: "",
    }) ?? "";
    const clientMessageId = stringField(body, "clientMessageId", {
      max: 128,
      fallback: "",
    })?.trim() || null;
    const attachmentIds = stringArrayField(body, "attachmentIds", {
      maxItems: MESSAGE_ATTACHMENT_LIMITS.maxFilesPerMessage,
      maxLength: 128,
      fallback: [],
    });
    if (!messageBody.trim() && !attachmentIds.length) {
      throw validationError("Enter a message or attach at least one file.");
    }
    const senderCompany = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        id: { in: [inquiry.buyerCompanyId, inquiry.sellerCompanyId] },
        deletedAt: null,
      },
    });
    const adminSenderCompany = !senderCompany && admin
      ? await getDb().company.findFirst({
          where: {
            id: { in: [inquiry.buyerCompanyId, inquiry.sellerCompanyId] },
            deletedAt: null,
            OR: [{ legalName: "Trade82 team" }, { tradeName: "Trade82 team" }],
          },
        })
      : null;
    const activeSenderCompany = senderCompany ?? adminSenderCompany;
    if (!activeSenderCompany) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (clientMessageId) {
      const existing = await getDb().message.findFirst({
        where: {
          inquiryId: inquiry.id,
          senderCompanyId: activeSenderCompany.id,
          clientMessageId,
        },
        include: {
          attachments: {
            where: { status: "active" },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (existing) return Response.json(existing);
    }
    const receiverCompanyId =
      activeSenderCompany.id === inquiry.buyerCompanyId
        ? inquiry.sellerCompanyId
        : inquiry.buyerCompanyId;
    const attachments = attachmentIds.length
      ? await getDb().messageAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            inquiryId: inquiry.id,
            uploadedByUserId: user.id,
            uploadedByCompanyId: activeSenderCompany.id,
            messageId: null,
            status: "restricted",
          },
          select: { id: true, sizeBytes: true },
        })
      : [];
    if (attachments.length !== attachmentIds.length) {
      throw validationError("One or more attachments could not be linked.");
    }
    const totalBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
    if (totalBytes > MESSAGE_ATTACHMENT_LIMITS.maxTotalBytesPerMessage) {
      throw validationError("Attachments are too large for one message.");
    }

    let message;
    try {
      message = await getDb().$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          inquiryId: inquiry.id,
          senderUserId: user.id,
          senderCompanyId: activeSenderCompany.id,
          receiverCompanyId,
          body: messageBody.trim(),
          contentHash: sha256Hex(messageBody.trim()),
          clientMessageId,
        },
      });

      if (attachmentIds.length) {
        await tx.messageAttachment.updateMany({
          where: {
            id: { in: attachmentIds },
            inquiryId: inquiry.id,
            uploadedByUserId: user.id,
            uploadedByCompanyId: activeSenderCompany.id,
            messageId: null,
            status: "restricted",
          },
          data: {
            messageId: created.id,
            status: "active",
          },
        });
      }

      await tx.inquiry.update({
        where: { id },
        data: { status: "replied" },
      });

      return tx.message.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          attachments: {
            where: { status: "active" },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      });
    } catch (error) {
      if (
        clientMessageId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await getDb().message.findFirstOrThrow({
          where: {
            inquiryId: inquiry.id,
            senderCompanyId: activeSenderCompany.id,
            clientMessageId,
          },
          include: {
            attachments: {
              where: { status: "active" },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        return Response.json(existing);
      }
      throw error;
    }

    after(async () => {
      await sendNewMessageNotification({
        messageId: message.id,
        inquiryId: inquiry.id,
        senderUserId: user.id,
        senderCompanyName: activeSenderCompany.tradeName || activeSenderCompany.legalName,
        receiverCompanyId,
        body: message.body,
        attachmentCount: message.attachments.length,
      }).catch((error) => {
        console.error("Message notification email failed.", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
    });

    return Response.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}
