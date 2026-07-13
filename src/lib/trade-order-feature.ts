import "server-only";

export type TradeOrderRolloutMode = "off" | "internal" | "on";

type RolloutEnvironment = {
  TRADE_ORDER_SYSTEM_MODE?: string;
  TRADE_ORDER_INTERNAL_USER_IDS?: string;
  MANUAL_PAYOUT_SYSTEM_MODE?: string;
  MANUAL_PAYOUT_INTERNAL_USER_IDS?: string;
};

const VALID_MODES = new Set<TradeOrderRolloutMode>(["off", "internal", "on"]);

function runtimeEnvironment(): RolloutEnvironment {
  return {
    TRADE_ORDER_SYSTEM_MODE: process.env.TRADE_ORDER_SYSTEM_MODE,
    TRADE_ORDER_INTERNAL_USER_IDS: process.env.TRADE_ORDER_INTERNAL_USER_IDS,
    MANUAL_PAYOUT_SYSTEM_MODE: process.env.MANUAL_PAYOUT_SYSTEM_MODE,
    MANUAL_PAYOUT_INTERNAL_USER_IDS: process.env.MANUAL_PAYOUT_INTERNAL_USER_IDS,
  };
}

function readMode(value: string | undefined): TradeOrderRolloutMode {
  const mode = value?.trim().toLowerCase();
  return mode && VALID_MODES.has(mode as TradeOrderRolloutMode)
    ? (mode as TradeOrderRolloutMode)
    : "off";
}

function isClerkUserId(value: string) {
  return /^user_[A-Za-z0-9_-]{1,128}$/.test(value);
}

function internalClerkUserIds(values: string | undefined) {
  return new Set(
    (values ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(isClerkUserId),
  );
}

function enabledForClerkUser(
  clerkUserId: string,
  mode: TradeOrderRolloutMode,
  internalUserIds: string | undefined,
) {
  if (!isClerkUserId(clerkUserId)) return false;
  return mode === "on" || (
    mode === "internal" && internalClerkUserIds(internalUserIds).has(clerkUserId)
  );
}

export function getTradeOrderSystemMode(env: RolloutEnvironment = runtimeEnvironment()) {
  return readMode(env.TRADE_ORDER_SYSTEM_MODE);
}

export function getManualPayoutSystemMode(env: RolloutEnvironment = runtimeEnvironment()) {
  return readMode(env.MANUAL_PAYOUT_SYSTEM_MODE);
}

// Internal allowlists intentionally contain Clerk user IDs (`user_...`), never
// database UserProfile IDs. These functions remain server-only and have no
// client-facing state or allowlist serialization.
export function isTradeOrderSystemEnabledForClerkUser(
  clerkUserId: string,
  env: RolloutEnvironment = runtimeEnvironment(),
) {
  return enabledForClerkUser(
    clerkUserId,
    getTradeOrderSystemMode(env),
    env.TRADE_ORDER_INTERNAL_USER_IDS,
  );
}

export function isManualPayoutSystemEnabledForClerkUser(
  clerkUserId: string,
  env: RolloutEnvironment = runtimeEnvironment(),
) {
  return enabledForClerkUser(
    clerkUserId,
    getManualPayoutSystemMode(env),
    env.MANUAL_PAYOUT_INTERNAL_USER_IDS,
  );
}
