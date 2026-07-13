export type SouthKoreanBankSeed = {
  countryCode: "KR";
  bankNameLocal: string;
  bankNameEnglish: string;
};

// Names only. No SWIFT/BIC, address, or website is seeded without a bank-owned
// verification source. The admin directory remains the source of truth for any
// later verified remittance metadata and manual corrections.
export const SOUTH_KOREAN_BANK_DIRECTORY_SEED: SouthKoreanBankSeed[] = [
  { countryCode: "KR", bankNameLocal: "KB국민은행", bankNameEnglish: "KB Kookmin Bank" },
  { countryCode: "KR", bankNameLocal: "신한은행", bankNameEnglish: "Shinhan Bank" },
  { countryCode: "KR", bankNameLocal: "우리은행", bankNameEnglish: "Woori Bank" },
  { countryCode: "KR", bankNameLocal: "하나은행", bankNameEnglish: "Hana Bank" },
  { countryCode: "KR", bankNameLocal: "NH농협은행", bankNameEnglish: "NH NongHyup Bank" },
  { countryCode: "KR", bankNameLocal: "IBK기업은행", bankNameEnglish: "IBK Industrial Bank of Korea" },
  { countryCode: "KR", bankNameLocal: "KDB산업은행", bankNameEnglish: "KDB Korea Development Bank" },
  { countryCode: "KR", bankNameLocal: "SC제일은행", bankNameEnglish: "Standard Chartered Bank Korea" },
  { countryCode: "KR", bankNameLocal: "한국씨티은행", bankNameEnglish: "Citibank Korea" },
  { countryCode: "KR", bankNameLocal: "수협은행", bankNameEnglish: "Suhyup Bank" },
  { countryCode: "KR", bankNameLocal: "BNK부산은행", bankNameEnglish: "Busan Bank" },
  { countryCode: "KR", bankNameLocal: "BNK경남은행", bankNameEnglish: "Kyongnam Bank" },
  { countryCode: "KR", bankNameLocal: "iM뱅크", bankNameEnglish: "iM Bank" },
  { countryCode: "KR", bankNameLocal: "광주은행", bankNameEnglish: "Gwangju Bank" },
  { countryCode: "KR", bankNameLocal: "전북은행", bankNameEnglish: "Jeonbuk Bank" },
  { countryCode: "KR", bankNameLocal: "제주은행", bankNameEnglish: "Jeju Bank" },
  { countryCode: "KR", bankNameLocal: "카카오뱅크", bankNameEnglish: "KakaoBank" },
  { countryCode: "KR", bankNameLocal: "케이뱅크", bankNameEnglish: "K Bank" },
  { countryCode: "KR", bankNameLocal: "토스뱅크", bankNameEnglish: "Toss Bank" },
  { countryCode: "KR", bankNameLocal: "우체국", bankNameEnglish: "Korea Post" },
];
