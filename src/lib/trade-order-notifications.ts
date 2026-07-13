import "server-only";

import {
  emailNotificationsEnabled,
  getEmailBaseUrl,
  sendTransactionalEmail,
} from "@/lib/email";
import {
  tradeOrderNotificationEmail,
  type TradeOrderNotificationKind,
} from "@/lib/email-templates";
import { getDb } from "@/lib/db";

type Recipient = "buyer" | "seller" | "both";

function orderPath(locale: "en" | "ko", orderNumber: string) {
  const path = `/orders/${encodeURIComponent(orderNumber)}`;
  return locale === "ko" ? `/ko${path}` : path;
}

// This is deliberately best effort. Financial state is committed and audited before
// any network call, so a mail-provider failure can never roll back an order or payout.
export async function sendTradeOrderNotification({
  orderId,
  kind,
  recipient,
  idempotencyKey,
}: {
  orderId: string;
  kind: TradeOrderNotificationKind;
  recipient: Recipient;
  idempotencyKey: string;
}) {
  if (!emailNotificationsEnabled()) return;

  const order = await getDb().tradeOrder.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      buyerCompanyName: true,
      sellerCompanyName: true,
      items: { take: 1, orderBy: { createdAt: "asc" }, select: { productName: true } },
      buyerCompany: { select: { id: true, owner: { select: { email: true, preferredLanguage: true } } } },
      sellerCompany: { select: { id: true, owner: { select: { email: true, preferredLanguage: true } } } },
    },
  });
  if (!order) return;

  const targets = [
    ...(recipient === "buyer" || recipient === "both" ? [{ role: "buyer" as const, company: order.buyerCompany }] : []),
    ...(recipient === "seller" || recipient === "both" ? [{ role: "seller" as const, company: order.sellerCompany }] : []),
  ];
  const sent = new Set<string>();
  for (const target of targets) {
    const emailAddress = target.company.owner.email?.trim().toLowerCase();
    if (!emailAddress || sent.has(emailAddress)) continue;
    sent.add(emailAddress);
    const locale = target.company.owner.preferredLanguage === "ko" ? "ko" : "en";
    const email = tradeOrderNotificationEmail({
      kind,
      orderNumber: order.orderNumber,
      productName: order.items[0]?.productName ?? "Trade82 order",
      counterpartyCompanyName: target.role === "buyer" ? order.sellerCompanyName : order.buyerCompanyName,
      ctaPath: orderPath(locale, order.orderNumber),
      locale,
      baseUrl: getEmailBaseUrl(),
    });
    await sendTransactionalEmail({
      to: emailAddress,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `${idempotencyKey}-${target.company.id}`,
    });
  }
}
