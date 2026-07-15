export const KOREAN_PAYOUT_COUNTRY = "KR";
export const KOREAN_PAYOUT_ACCOUNT_TYPE = "LOCAL" as const;
export const KOREAN_PAYOUT_CURRENCY = "krw";
export const KOREAN_PAYOUT_SUPPORTED_CURRENCIES = [KOREAN_PAYOUT_CURRENCY] as const;

export function assertKoreanPayoutConfiguration({
  country,
  accountType,
  payoutCurrency,
  supportedCurrencies,
}: {
  country: unknown;
  accountType: unknown;
  payoutCurrency: unknown;
  supportedCurrencies: unknown;
}) {
  if (country !== KOREAN_PAYOUT_COUNTRY) {
    throw new Error("Payout country must be KR.");
  }
  if (accountType !== KOREAN_PAYOUT_ACCOUNT_TYPE) {
    throw new Error("Payout account type must be LOCAL.");
  }
  if (payoutCurrency !== KOREAN_PAYOUT_CURRENCY) {
    throw new Error("Payout currency must be krw.");
  }
  if (
    !Array.isArray(supportedCurrencies) ||
    supportedCurrencies.length !== 1 ||
    supportedCurrencies[0] !== KOREAN_PAYOUT_CURRENCY
  ) {
    throw new Error("Supported payout currencies must be [krw].");
  }
}

export function normalizeKoreanAccountNumber(value: string) {
  const normalized = value.replace(/[\s-]+/g, "");
  if (!/^\d{4,64}$/.test(normalized)) {
    throw new Error("Account number must contain 4 to 64 digits.");
  }
  return normalized;
}
