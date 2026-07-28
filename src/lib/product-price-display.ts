export function formatProductPrice(
  value: unknown,
  currency: unknown = "USD",
) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const code = typeof currency === "string" && currency.trim() ? currency.trim() : "USD";
  return `${code} ${amount.toFixed(2)}`;
}
