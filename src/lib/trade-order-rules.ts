export function formatTradeOrderNumber(year: number, sequence: number) {
  if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invalid trade order number components.");
  }
  return `T82-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatSellerPayoutNumber(year: number, sequence: number) {
  if (!Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invalid seller payout number components.");
  }
  return `PAY-T82-${year}-${String(sequence).padStart(4, "0")}`;
}

export function immutableCompanySnapshot(company: {
  legalName: string;
  tradeName?: string | null;
  owner: { displayName: string; email: string; phoneNumber?: string | null };
  country: string;
  businessAddress?: string | null;
}) {
  return {
    companyName: company.tradeName?.trim() || company.legalName,
    contactName: company.owner.displayName || null,
    email: company.owner.email,
    phone: company.owner.phoneNumber || null,
    country: company.country,
    address: company.businessAddress || null,
  };
}
