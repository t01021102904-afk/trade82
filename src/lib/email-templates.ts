type EmailLocale = "en" | "ko";

type EmailRender = {
  subject: string;
  html: string;
  text: string;
};

type BrandedEmailOptions = {
  locale?: EmailLocale;
  preview: string;
  title: string;
  intro: string;
  body?: string;
  ctaLabel?: string;
  ctaPath?: string;
  baseUrl?: string;
  footer?: string;
};

type VerificationCodeEmailInput = {
  code: string;
  expiresInMinutes?: number;
  locale?: EmailLocale;
};

type PlatformNoticeEmailInput = {
  message: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

type DealCompletionRequestEmailInput = {
  requesterCompanyName: string;
  dealTitle: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

type ReviewRequestEmailInput = {
  dealTitle: string;
  counterpartyCompanyName: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

type InquiryNotificationEmailInput = {
  senderCompanyName: string;
  messagePreview: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

type MessageNotificationEmailInput = {
  senderCompanyName: string;
  messagePreview: string;
  hasAttachments?: boolean;
  ctaPath: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

type SecurityNoticeEmailInput = {
  notice: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

export type TradeOrderNotificationKind =
  | "order_created"
  | "payment_received"
  | "shipment_updated"
  | "payout_on_hold"
  | "payout_sent"
  | "payout_failed";

type TradeOrderNotificationEmailInput = {
  kind: TradeOrderNotificationKind;
  orderNumber: string;
  productName: string;
  counterpartyCompanyName: string;
  ctaPath: string;
  locale?: EmailLocale;
  baseUrl?: string;
};

const brandName = "Trade82";
const brandPrefix = brandName.slice(0, -2);
const brandSuffix = brandName.slice(-2);
const accentColor = "#22c55e";
const darkText = "#18181b";
const mutedText = "#52525b";

export const defaultEmailFrom = {
  en: "Trade82 <noreply@trade82.com>",
  enTeam: "Trade82 Team <noreply@trade82.com>",
  koTeam: "Trade82 운영팀 <noreply@trade82.com>",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textOnly(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function safeInternalPath(value: string | undefined, fallback = "/messages") {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

function safeBaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function emailHref(baseUrl: string | undefined, path: string | undefined) {
  const safePath = safeInternalPath(path);
  const base = safeBaseUrl(baseUrl);
  if (!base) return safePath;
  return new URL(safePath, base).toString();
}

function paragraphs(value: string | undefined) {
  if (!value) return "";
  return value
    .split(/\n{2,}/)
    .map((paragraph) => textOnly(paragraph))
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:${mutedText};font-size:15px;line-height:24px;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
}

function renderBrandedEmail({
  locale = "en",
  preview,
  title,
  intro,
  body,
  ctaLabel,
  ctaPath,
  baseUrl,
  footer,
}: BrandedEmailOptions): EmailRender {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safePreview = escapeHtml(preview);
  const href = ctaLabel ? emailHref(baseUrl, ctaPath) : "";
  const direction = locale === "ko" ? "ltr" : "ltr";
  const defaultFooter =
    locale === "ko"
      ? "이 이메일은 Trade82 플랫폼 이용과 관련된 거래성 안내입니다."
      : "This is a transactional email related to your Trade82 account.";
  const footerText = footer ?? defaultFooter;
  const textParts = [
    title,
    intro,
    body,
    ctaLabel && href ? `${ctaLabel}: ${href}` : "",
    footerText,
  ].filter(Boolean);

  return {
    subject: title,
    text: textParts.join("\n\n"),
    html: `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f4f7f5;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${darkText};" dir="${direction}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;width:100%;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 0 16px;">
                <div style="font-size:22px;font-weight:750;letter-spacing:-0.02em;color:${darkText};">
                  ${escapeHtml(brandPrefix)}<span style="color:${accentColor};">${escapeHtml(brandSuffix)}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #dfe7e2;border-radius:16px;background:#ffffff;padding:32px;box-shadow:0 8px 30px rgba(24,24,27,0.06);">
                <div style="height:4px;width:48px;border-radius:999px;background:${accentColor};margin:0 0 24px;"></div>
                <h1 style="margin:0 0 14px;color:${darkText};font-size:24px;line-height:32px;font-weight:750;letter-spacing:-0.02em;">${safeTitle}</h1>
                <p style="margin:0 0 18px;color:${mutedText};font-size:15px;line-height:24px;">${safeIntro}</p>
                ${paragraphs(body)}
                ${
                  ctaLabel
                    ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;border-radius:10px;background:${darkText};color:#ffffff;font-size:14px;font-weight:700;line-height:20px;text-decoration:none;padding:12px 18px;">${escapeHtml(ctaLabel)}</a></p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;color:#71717a;font-size:12px;line-height:18px;">
                ${escapeHtml(footerText)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

export function verificationCodeEmail({
  code,
  expiresInMinutes,
  locale = "en",
}: VerificationCodeEmailInput): EmailRender {
  const title = locale === "ko" ? "Trade82 인증 코드" : "Your Trade82 verification code";
  const intro =
    locale === "ko"
      ? "아래 코드를 입력해 Trade82 요청을 완료하세요."
      : "Enter the code below to complete your Trade82 request.";
  const expiresText = expiresInMinutes
    ? locale === "ko"
      ? `이 코드는 약 ${expiresInMinutes}분 후 만료됩니다.`
      : `This code expires in about ${expiresInMinutes} minutes.`
    : locale === "ko"
      ? "이 코드는 곧 만료됩니다."
      : "This code expires soon.";
  const body =
    locale === "ko"
      ? `인증 코드: ${code}\n\n${expiresText}\n\n이 코드를 다른 사람과 공유하지 마세요. 본인이 요청하지 않았다면 이 이메일을 무시해도 됩니다.`
      : `Verification code: ${code}\n\n${expiresText}\n\nDo not share this code with anyone. If you did not request it, you can ignore this email.`;

  const email = renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro,
    body,
  });

  return {
    ...email,
    html: email.html.replace(
      escapeHtml(`Verification code: ${code}`),
      `<span style="display:block;margin:8px 0 20px;font-size:32px;line-height:40px;letter-spacing:0.16em;font-weight:800;color:${darkText};">${escapeHtml(code)}</span>`,
    ).replace(
      escapeHtml(`인증 코드: ${code}`),
      `<span style="display:block;margin:8px 0 20px;font-size:32px;line-height:40px;letter-spacing:0.16em;font-weight:800;color:${darkText};">${escapeHtml(code)}</span>`,
    ),
  };
}

export function platformNoticeEmail({
  message,
  locale = "en",
  baseUrl,
}: PlatformNoticeEmailInput): EmailRender {
  const title = locale === "ko" ? "Trade82 운영팀 안내" : "New platform notice from Trade82";
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? "Trade82 운영팀에서 보내는 플랫폼 안내입니다."
        : "This is a platform notice from the Trade82 team.",
    body: message,
    ctaLabel: locale === "ko" ? "메시지 보기" : "Open messages",
    ctaPath: locale === "ko" ? "/ko/messages" : "/messages",
    baseUrl,
  });
}

export function dealCompletionRequestEmail({
  requesterCompanyName,
  dealTitle,
  locale = "en",
  baseUrl,
}: DealCompletionRequestEmailInput): EmailRender {
  const title =
    locale === "ko"
      ? "거래 완료 확인 요청"
      : "Deal completion request";
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? `${requesterCompanyName}에서 거래 완료 확인을 요청했습니다.`
        : `${requesterCompanyName} requested confirmation that a deal is complete.`,
    body:
      locale === "ko"
        ? `거래: ${dealTitle}\n\nTrade82에서 거래 내용을 확인하고 완료 여부를 응답하세요.`
        : `Deal: ${dealTitle}\n\nOpen Trade82 to review the deal and respond to the completion request.`,
    ctaLabel: locale === "ko" ? "거래 확인하기" : "Review deal",
    ctaPath: locale === "ko" ? "/ko/messages" : "/messages",
    baseUrl,
  });
}

export function reviewRequestEmail({
  dealTitle,
  counterpartyCompanyName,
  locale = "en",
  baseUrl,
}: ReviewRequestEmailInput): EmailRender {
  const title =
    locale === "ko"
      ? "거래 후기 작성 요청"
      : "Review request for a completed deal";
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? `${counterpartyCompanyName}와의 거래가 완료되었습니다.`
        : `Your deal with ${counterpartyCompanyName} is complete.`,
    body:
      locale === "ko"
        ? `거래: ${dealTitle}\n\n거래 경험을 바탕으로 후기를 작성할 수 있습니다.`
        : `Deal: ${dealTitle}\n\nYou can now leave a review based on the completed transaction.`,
    ctaLabel: locale === "ko" ? "후기 작성하기" : "Write a review",
    ctaPath: locale === "ko" ? "/ko/messages" : "/messages",
    baseUrl,
  });
}

export function inquiryNotificationEmail({
  senderCompanyName,
  messagePreview,
  locale = "en",
  baseUrl,
}: InquiryNotificationEmailInput): EmailRender {
  const title =
    locale === "ko"
      ? "새 문의가 도착했습니다"
      : "New inquiry on Trade82";
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? `${senderCompanyName}에서 새 문의를 보냈습니다.`
        : `${senderCompanyName} sent you a new inquiry.`,
    body: messagePreview,
    ctaLabel: locale === "ko" ? "문의 보기" : "Open inquiry",
    ctaPath: locale === "ko" ? "/ko/messages" : "/messages",
    baseUrl,
  });
}

export function messageNotificationEmail({
  senderCompanyName,
  messagePreview,
  hasAttachments = false,
  ctaPath,
  locale = "en",
  baseUrl,
}: MessageNotificationEmailInput): EmailRender {
  const title =
    locale === "ko"
      ? "Trade82 새 메시지가 도착했습니다"
      : "New message on Trade82";
  const attachmentNote = hasAttachments
    ? locale === "ko"
      ? "이 메시지에는 첨부파일이 포함되어 있습니다. 로그인해서 확인하세요."
      : "This message includes attachments. Sign in to view them."
    : "";
  const body = [messagePreview, attachmentNote].filter(Boolean).join("\n\n");

  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? `${senderCompanyName}에서 새 메시지를 보냈습니다.`
        : `${senderCompanyName} sent you a new message.`,
    body,
    ctaLabel: locale === "ko" ? "메시지 보기" : "Open message",
    ctaPath,
    baseUrl,
  });
}

export function tradeOrderNotificationEmail({
  kind,
  orderNumber,
  productName,
  counterpartyCompanyName,
  ctaPath,
  locale = "en",
  baseUrl,
}: TradeOrderNotificationEmailInput): EmailRender {
  const english = {
    order_created: ["Order created", "A Trade82 order is ready for review."],
    payment_received: ["Payment received", "Payment was confirmed for your Trade82 order."],
    shipment_updated: ["Shipment updated", "Shipment information was updated for your Trade82 order."],
    payout_on_hold: ["Seller payout on hold", "A seller payout requires review before it can proceed."],
    payout_sent: ["Seller payout marked as sent", "Trade82 recorded an external seller payout as sent."],
    payout_failed: ["Seller payout needs attention", "A seller payout could not be completed and requires review."],
  } as const;
  const korean = {
    order_created: ["주문이 생성되었습니다", "Trade82 주문이 검토 준비되었습니다."],
    payment_received: ["결제가 확인되었습니다", "Trade82 주문의 결제가 확인되었습니다."],
    shipment_updated: ["배송 정보가 업데이트되었습니다", "Trade82 주문의 배송 정보가 업데이트되었습니다."],
    payout_on_hold: ["셀러 정산이 보류되었습니다", "셀러 정산을 진행하기 전에 검토가 필요합니다."],
    payout_sent: ["셀러 정산이 전송 완료로 기록되었습니다", "Trade82가 외부 셀러 정산을 전송 완료로 기록했습니다."],
    payout_failed: ["셀러 정산 확인이 필요합니다", "셀러 정산을 완료할 수 없어 검토가 필요합니다."],
  } as const;
  const [title, intro] = (locale === "ko" ? korean : english)[kind];
  const body = locale === "ko"
    ? `주문 번호: ${orderNumber}\n상품: ${productName}\n상대 회사: ${counterpartyCompanyName}`
    : `Order: ${orderNumber}\nProduct: ${productName}\nCounterparty: ${counterpartyCompanyName}`;
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro,
    body,
    ctaLabel: locale === "ko" ? "주문 보기" : "View order",
    ctaPath,
    baseUrl,
  });
}

export function securityNoticeEmail({
  notice,
  locale = "en",
  baseUrl,
}: SecurityNoticeEmailInput): EmailRender {
  const title = locale === "ko" ? "Trade82 보안 알림" : "Trade82 security notice";
  return renderBrandedEmail({
    locale,
    preview: title,
    title,
    intro:
      locale === "ko"
        ? "Trade82 계정 보안과 관련된 안내입니다."
        : "This notice is related to your Trade82 account security.",
    body: notice,
    ctaLabel: locale === "ko" ? "계정 확인하기" : "Review account",
    ctaPath: locale === "ko" ? "/ko/settings/profile" : "/settings/profile",
    baseUrl,
  });
}
