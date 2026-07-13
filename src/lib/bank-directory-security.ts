export type VerifiedBankDirectoryValues = {
  bankNameEnglish: string;
  defaultSwiftBic: string | null;
  defaultBankAddress: string | null;
  officialWebsite?: string | null;
  verifiedAt: Date | string | null;
};

function isIpLiteral(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

export function isSafeOfficialBankWebsite(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !isIpLiteral(hostname)
    );
  } catch {
    return false;
  }
}

export function verifiedBankAutofill(
  bank: VerifiedBankDirectoryValues | null,
  manualOverride: boolean,
) {
  if (!bank?.verifiedAt || manualOverride) return null;
  return {
    bankName: bank.bankNameEnglish,
    swiftBic: bank.defaultSwiftBic,
    bankAddress: bank.defaultBankAddress,
    officialWebsite: isSafeOfficialBankWebsite(bank.officialWebsite)
      ? bank.officialWebsite
      : null,
  };
}
