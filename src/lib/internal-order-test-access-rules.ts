export type InternalOrderTestEnvironment = {
  INTERNAL_ORDER_TEST_MODE?: string;
  INTERNAL_ORDER_TESTER_CLERK_IDS?: string;
  TRADE_ORDER_SYSTEM_MODE?: string;
  MANUAL_PAYOUT_SYSTEM_MODE?: string;
};

const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9_-]{1,128}$/;

function parseStrictTesterAllowlist(value: string | undefined) {
  if (!value) return null;

  const values = value.split(",");
  if (!values.length || values.some((item) => !CLERK_USER_ID_PATTERN.test(item))) {
    return null;
  }

  return new Set(values);
}

// This deliberately accepts only the exact literal "on". Missing, blank,
// whitespace-padded, case-changed, and otherwise malformed values all deny access.
export function isInternalOrderTestEnabledForClerkUser(
  clerkUserId: string | null | undefined,
  environment: InternalOrderTestEnvironment,
) {
  if (!clerkUserId || !CLERK_USER_ID_PATTERN.test(clerkUserId)) return false;
  if (environment.INTERNAL_ORDER_TEST_MODE !== "on") return false;
  if (
    environment.TRADE_ORDER_SYSTEM_MODE !== "off"
    || environment.MANUAL_PAYOUT_SYSTEM_MODE !== "off"
  ) {
    return false;
  }

  const allowlist = parseStrictTesterAllowlist(environment.INTERNAL_ORDER_TESTER_CLERK_IDS);
  return Boolean(allowlist?.has(clerkUserId));
}
