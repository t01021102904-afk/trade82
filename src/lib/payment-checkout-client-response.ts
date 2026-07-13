export type PaymentCheckoutResponsePayload = {
  url?: unknown;
  status?: unknown;
  message?: unknown;
  error?: unknown;
} | null;

export type PaymentCheckoutResponseDecision =
  | { action: "redirect"; url: string }
  | { action: "processing"; message: string }
  | { action: "error"; message: string };

function messageOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validCheckoutUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// This is deliberately client-only response handling. It never retries Checkout
// or changes payment state; the browser may redirect only for an explicit 200 URL.
export function decidePaymentCheckoutResponse({
  statusCode,
  payload,
  processingFallback,
  errorFallback,
}: {
  statusCode: number;
  payload: PaymentCheckoutResponsePayload;
  processingFallback: string;
  errorFallback: string;
}): PaymentCheckoutResponseDecision {
  if (statusCode === 202 || payload?.status === "processing") {
    return {
      action: "processing",
      message: messageOrFallback(payload?.message, processingFallback),
    };
  }

  const checkoutUrl = validCheckoutUrl(payload?.url);
  if (statusCode === 200 && checkoutUrl) {
    return { action: "redirect", url: checkoutUrl };
  }

  if (statusCode < 200 || statusCode >= 300) {
    return {
      action: "error",
      message: messageOrFallback(payload?.error, errorFallback),
    };
  }

  return { action: "error", message: errorFallback };
}
