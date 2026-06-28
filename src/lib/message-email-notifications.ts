import "server-only";

import { getDb } from "@/lib/db";
import {
  emailNotificationsEnabled,
  getEmailBaseUrl,
  sendTransactionalEmail,
} from "@/lib/email";
import { messageNotificationEmail } from "@/lib/email-templates";

type NewMessageNotificationInput = {
  messageId: string;
  inquiryId: string;
  senderUserId: string;
  senderCompanyName: string;
  receiverCompanyId: string;
  body: string;
  attachmentCount: number;
};

function companyDisplayName(name: string | null | undefined, fallback: string) {
  return name?.trim() || fallback;
}

function previewText(body: string, locale: "en" | "ko", hasAttachments: boolean) {
  const normalized = body.replace(/\s+/g, " ").trim();
  const fallback =
    locale === "ko"
      ? "첨부파일이 포함된 메시지입니다."
      : "This message includes attachments.";
  const source = normalized || (hasAttachments ? fallback : "");
  if (source.length <= 150) return source;
  return `${source.slice(0, 149)}…`;
}

function messagesPath(locale: "en" | "ko", inquiryId: string) {
  const path = `/messages?inquiryId=${encodeURIComponent(inquiryId)}`;
  return locale === "ko" ? `/ko${path}` : path;
}

export async function sendNewMessageNotification({
  messageId,
  inquiryId,
  senderUserId,
  senderCompanyName,
  receiverCompanyId,
  body,
  attachmentCount,
}: NewMessageNotificationInput) {
  if (!emailNotificationsEnabled()) return;

  const recipientCompany = await getDb().company.findUnique({
    where: { id: receiverCompanyId },
    select: {
      owner: {
        select: {
          id: true,
          email: true,
          preferredLanguage: true,
        },
      },
    },
  });

  const recipient = recipientCompany?.owner;
  if (!recipient?.email || recipient.id === senderUserId) return;

  const locale = recipient.preferredLanguage === "ko" ? "ko" : "en";
  const hasAttachments = attachmentCount > 0;
  const email = messageNotificationEmail({
    senderCompanyName: companyDisplayName(senderCompanyName, "Trade82 member"),
    messagePreview: previewText(body, locale, hasAttachments),
    hasAttachments,
    ctaPath: messagesPath(locale, inquiryId),
    locale,
    baseUrl: getEmailBaseUrl(),
  });

  await sendTransactionalEmail({
    to: recipient.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `trade82-message-${messageId}`,
  });
}
