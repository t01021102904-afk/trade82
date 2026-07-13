export type MessagePaymentRequestMode = "off" | "internal" | "on";

type PaymentFeatureEnvironment = {
  MESSAGE_PAYMENT_REQUEST_MODE?: string;
  MESSAGE_PAYMENT_INTERNAL_USER_IDS?: string;
};

const VALID_MODES = new Set<MessagePaymentRequestMode>(["off", "internal", "on"]);

function runtimePaymentFeatureEnvironment(): PaymentFeatureEnvironment {
  return {
    MESSAGE_PAYMENT_REQUEST_MODE: process.env.MESSAGE_PAYMENT_REQUEST_MODE,
    MESSAGE_PAYMENT_INTERNAL_USER_IDS: process.env.MESSAGE_PAYMENT_INTERNAL_USER_IDS,
  };
}

// Missing or malformed rollout configuration must never enable payments.
export function getMessagePaymentRequestMode(
  env: PaymentFeatureEnvironment = runtimePaymentFeatureEnvironment(),
): MessagePaymentRequestMode {
  const candidate = env.MESSAGE_PAYMENT_REQUEST_MODE?.trim().toLowerCase();
  return candidate && VALID_MODES.has(candidate as MessagePaymentRequestMode)
    ? (candidate as MessagePaymentRequestMode)
    : "off";
}

function internalUserIds(env: PaymentFeatureEnvironment) {
  return new Set(
    (env.MESSAGE_PAYMENT_INTERNAL_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isMessagePaymentFeatureEnabledForUser(
  userId: string,
  env: PaymentFeatureEnvironment = runtimePaymentFeatureEnvironment(),
) {
  const mode = getMessagePaymentRequestMode(env);
  if (mode === "on") return true;
  if (mode === "internal") return internalUserIds(env).has(userId);
  return false;
}

// This response shape is safe for the client. It deliberately does not disclose
// rollout mode or the configured internal-user allowlist.
export function getMessagePaymentFeatureState(
  userId: string,
  env: PaymentFeatureEnvironment = runtimePaymentFeatureEnvironment(),
) {
  return { enabled: isMessagePaymentFeatureEnabledForUser(userId, env) };
}

// Only payment-card loading is optional. Callers must load normal inquiry and
// message data outside this wrapper so those failures continue to surface.
export async function loadOptionalMessagePaymentData<T>({
  enabled,
  load,
  onError,
}: {
  enabled: boolean;
  load: () => Promise<T>;
  onError?: (error: unknown) => void;
}): Promise<T | null> {
  if (!enabled) return null;

  try {
    return await load();
  } catch (error) {
    onError?.(error);
    return null;
  }
}
