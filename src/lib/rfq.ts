import type { Locale } from "@/lib/i18n";
import type { Product } from "@/lib/types";

export const rfqStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "MATCHING_READY",
  "CLOSED",
  "CANCELLED",
] as const;

export type RfqStatus = (typeof rfqStatuses)[number];

export type RfqAdminStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export const rfqMatchReasonCodes = [
  "same_category",
  "similar_keywords",
  "exports_destination",
  "matching_material",
  "matching_certification",
  "matching_feature",
  "similar_description",
] as const;

export type RfqMatchReasonCode = (typeof rfqMatchReasonCodes)[number];

export type RfqSuggestedMatch = {
  id: string;
  productId: string;
  rank: number;
  reasons: RfqMatchReasonCode[];
  product: Product;
};

export type RfqRecord = {
  id: string;
  buyerUserId: string;
  buyerCompanyId: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerCompanyName?: string | null;
  productName: string;
  category: string;
  sourcingType: string;
  sourcingPurpose: string | null;
  quantity: string;
  tradeTerms: string;
  destinationCountry: string | null;
  preferredUnitPriceAmount: string | null;
  preferredUnitPriceCurrency: "USD" | "KRW" | null;
  shape: string | null;
  capacity: string | null;
  material: string | null;
  certification: string | null;
  feature: string | null;
  targetDeliveryDate: string | null;
  details: string;
  status: RfqStatus;
  adminStatus: RfqAdminStatus;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  suggestedMatches?: RfqSuggestedMatch[];
  createdAt: string;
  updatedAt: string;
};

export type RfqFormValue = {
  productName: string;
  category: string;
  sourcingType: string;
  sourcingPurpose: string;
  quantity: string;
  tradeTerms: string;
  destinationCountry: string;
  preferredUnitPriceAmount: string;
  preferredUnitPriceCurrency: "USD" | "KRW";
  shape: string;
  capacity: string;
  material: string;
  certification: string;
  feature: string;
  targetDeliveryDate: string;
  details: string;
};

export function isRfqRecord(value: unknown): value is RfqRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "productName" in value &&
      "status" in value,
  );
}

export function rfqApiErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export const emptyRfqFormValue: RfqFormValue = {
  productName: "",
  category: "",
  sourcingType: "",
  sourcingPurpose: "",
  quantity: "",
  tradeTerms: "",
  destinationCountry: "",
  preferredUnitPriceAmount: "",
  preferredUnitPriceCurrency: "USD",
  shape: "",
  capacity: "",
  material: "",
  certification: "",
  feature: "",
  targetDeliveryDate: "",
  details: "",
};

export function rfqFormValueFromRecord(rfq: RfqRecord): RfqFormValue {
  return {
    productName: rfq.productName,
    category: rfq.category,
    sourcingType: rfq.sourcingType,
    sourcingPurpose: rfq.sourcingPurpose ?? "",
    quantity: rfq.quantity,
    tradeTerms: rfq.tradeTerms,
    destinationCountry: rfq.destinationCountry ?? "",
    preferredUnitPriceAmount: rfq.preferredUnitPriceAmount ?? "",
    preferredUnitPriceCurrency: rfq.preferredUnitPriceCurrency ?? "USD",
    shape: rfq.shape ?? "",
    capacity: rfq.capacity ?? "",
    material: rfq.material ?? "",
    certification: rfq.certification ?? "",
    feature: rfq.feature ?? "",
    targetDeliveryDate: rfq.targetDeliveryDate?.slice(0, 10) ?? "",
    details: rfq.details,
  };
}

export function sourcingTypeOptions(locale: Locale) {
  return locale === "ko"
    ? [
        { value: "wholesale", label: "도매" },
        { value: "distributor_sourcing", label: "유통사 소싱" },
        { value: "private_label", label: "자체 브랜드" },
        { value: "oem_odm", label: "OEM / ODM" },
        { value: "sample_request", label: "샘플 요청" },
        { value: "retail_supply", label: "리테일 공급" },
        { value: "other", label: "기타" },
      ]
    : [
        { value: "wholesale", label: "Wholesale" },
        { value: "distributor_sourcing", label: "Distributor sourcing" },
        { value: "private_label", label: "Private label" },
        { value: "oem_odm", label: "OEM / ODM" },
        { value: "sample_request", label: "Sample request" },
        { value: "retail_supply", label: "Retail supply" },
        { value: "other", label: "Other" },
      ];
}

export function sourcingPurposeOptions(locale: Locale) {
  return locale === "ko"
    ? [
        { value: "compare_suppliers", label: "공급사 비교" },
        { value: "request_quotation", label: "견적 요청" },
        { value: "private_label_partner", label: "자체 브랜드 파트너 찾기" },
        { value: "request_samples", label: "샘플 요청" },
        { value: "check_export_readiness", label: "수출 가능 여부 확인" },
        { value: "other", label: "기타" },
      ]
    : [
        { value: "compare_suppliers", label: "Compare suppliers" },
        { value: "request_quotation", label: "Request quotation" },
        { value: "private_label_partner", label: "Find private label partner" },
        { value: "request_samples", label: "Request samples" },
        { value: "check_export_readiness", label: "Check export readiness" },
        { value: "other", label: "Other" },
      ];
}

export function tradeTermOptions(locale: Locale) {
  const unsure =
    locale === "ko"
      ? { value: "not_sure", label: "잘 모름 / 상담 필요" }
      : { value: "not_sure", label: "Not sure / Need guidance" };
  return [
    { value: "EXW", label: "EXW" },
    { value: "FOB", label: "FOB" },
    { value: "CIF", label: "CIF" },
    { value: "DDP", label: "DDP" },
    { value: "DAP", label: "DAP" },
    unsure,
  ];
}

export function currencyOptions() {
  return [
    { value: "USD", label: "USD" },
    { value: "KRW", label: "KRW" },
  ];
}

export function rfqStatusLabel(status: RfqStatus, locale: Locale) {
  const labels: Record<RfqStatus, { en: string; ko: string }> = {
    DRAFT: { en: "Draft", ko: "작성중" },
    SUBMITTED: { en: "Submitted", ko: "제출됨" },
    UNDER_REVIEW: { en: "Under review", ko: "검토중" },
    APPROVED: { en: "Approved", ko: "승인됨" },
    REJECTED: { en: "Rejected", ko: "거절됨" },
    MATCHING_READY: { en: "Ready for matching", ko: "매칭 준비 완료" },
    CLOSED: { en: "Closed", ko: "종료됨" },
    CANCELLED: { en: "Cancelled", ko: "취소됨" },
  };
  return labels[status]?.[locale] ?? status;
}

export function normalizeRfqMatchReason(value: string): RfqMatchReasonCode | null {
  return rfqMatchReasonCodes.includes(value as RfqMatchReasonCode)
    ? (value as RfqMatchReasonCode)
    : null;
}

export function rfqMatchReasonLabel(reason: RfqMatchReasonCode, locale: Locale) {
  const labels: Record<RfqMatchReasonCode, { en: string; ko: string }> = {
    same_category: { en: "Same category", ko: "같은 카테고리" },
    similar_keywords: { en: "Similar keywords", ko: "유사 키워드" },
    exports_destination: {
      en: "Seller exports to destination country",
      ko: "납품 국가 수출 대응 가능",
    },
    matching_material: { en: "Matching material", ko: "유사 소재" },
    matching_certification: { en: "Matching certification", ko: "유사 인증" },
    matching_feature: { en: "Matching feature", ko: "유사 특징" },
    similar_description: {
      en: "Similar product description",
      ko: "유사 상품 설명",
    },
  };
  return labels[reason][locale];
}

export function canEditRfq(status: RfqStatus) {
  return status === "DRAFT" || status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "REJECTED";
}

export function canCancelRfq(status: RfqStatus) {
  return status !== "CANCELLED" && status !== "CLOSED" && status !== "MATCHING_READY" && status !== "APPROVED";
}
