export const ORDER_TABLE_COLUMNS = [
  "orderNumber",
  "createdAt",
  "orderStatus",
  "paymentStatus",
  "shipmentStatus",
  "payoutStatus",
  "buyerCompany",
  "buyerContact",
  "buyerCountry",
  "sellerCompany",
  "sellerContact",
  "sellerCountry",
  "product",
  "quantity",
  "grossAmount",
  "platformFeeAmount",
  "sellerPayableAmount",
  "currency",
  "bankName",
  "maskedAccount",
  "swiftBic",
  "payoutCurrency",
  "incoterm",
  "shippingMethod",
  "originCountry",
  "destinationCountry",
  "carrier",
  "trackingNumber",
  "shipDate",
  "paidDate",
  "payoutSentDate",
  "updatedAt",
] as const;

export type OrderTableColumn = (typeof ORDER_TABLE_COLUMNS)[number];

export const DEFAULT_ORDER_TABLE_COLUMNS: OrderTableColumn[] = [
  "orderNumber",
  "createdAt",
  "orderStatus",
  "paymentStatus",
  "shipmentStatus",
  "payoutStatus",
  "buyerCompany",
  "sellerCompany",
  "product",
  "grossAmount",
  "platformFeeAmount",
  "sellerPayableAmount",
  "currency",
  "bankName",
  "maskedAccount",
  "trackingNumber",
  "updatedAt",
];

const ORDER_TABLE_COLUMN_SET = new Set<string>(ORDER_TABLE_COLUMNS);

/** Stores only whitelisted column IDs, never values from an order response. */
export function sanitizeOrderTableColumnVisibility(value: unknown): OrderTableColumn[] {
  if (!Array.isArray(value)) return DEFAULT_ORDER_TABLE_COLUMNS;
  const unique = [...new Set(value.filter((item): item is string => typeof item === "string"))]
    .filter((item): item is OrderTableColumn => ORDER_TABLE_COLUMN_SET.has(item));
  return unique.length ? unique : DEFAULT_ORDER_TABLE_COLUMNS;
}

export const ADMIN_ORDER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "orderNumber",
  "buyerCompanyName",
  "sellerCompanyName",
  "grossAmount",
  "platformFeeAmount",
  "sellerPayableAmount",
  "paidAt",
] as const;

export type AdminOrderSortField = (typeof ADMIN_ORDER_SORT_FIELDS)[number];

export function adminOrderSortField(value: string | null): AdminOrderSortField {
  return (ADMIN_ORDER_SORT_FIELDS as readonly string[]).includes(value ?? "")
    ? (value as AdminOrderSortField)
    : "createdAt";
}

export function adminOrderSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

export function maskStripeIdentifier(value: string | null | undefined, prefix: "cs" | "pi" | "ch") {
  if (!value) return null;
  return `${prefix}_...${value.slice(-4)}`;
}

export type CurrencyTotalInput = {
  currency: string;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
};

export function currencyTotals(rows: CurrencyTotalInput[]) {
  const totals: Record<string, { grossAmount: number; platformFeeAmount: number; sellerPayableAmount: number }> = {};
  for (const row of rows) {
    const currency = row.currency.toLowerCase();
    const current = totals[currency] ?? { grossAmount: 0, platformFeeAmount: 0, sellerPayableAmount: 0 };
    current.grossAmount += row.grossAmount;
    current.platformFeeAmount += row.platformFeeAmount;
    current.sellerPayableAmount += row.sellerPayableAmount;
    totals[currency] = current;
  }
  return totals;
}
