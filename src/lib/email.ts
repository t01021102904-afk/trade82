import "server-only";

type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export function emailNotificationsEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED?.trim().toLowerCase() === "true";
}

export function getEmailBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
}

function logEmailWarning(message: string, details?: Record<string, unknown>) {
  console.warn(message, details);
}

function logEmailError(message: string, details?: Record<string, unknown>) {
  console.error(message, details);
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: TransactionalEmailInput) {
  if (!emailNotificationsEnabled()) {
    return { sent: false, skipped: true, reason: "disabled" as const };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    logEmailWarning("Email notifications are enabled but email provider config is missing.");
    return { sent: false, skipped: true, reason: "missing_config" as const };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      logEmailError("Email notification send failed.", {
        status: response.status,
      });
      return { sent: false, skipped: false, reason: "provider_error" as const };
    }

    return { sent: true, skipped: false, reason: null };
  } catch (error) {
    logEmailError("Email notification send failed.", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return { sent: false, skipped: false, reason: "network_error" as const };
  }
}
