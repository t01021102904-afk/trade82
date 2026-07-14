export type OptionLocale = "en" | "ko";

type LocalizedOption = {
  value: string;
  en: string;
  ko: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export const UNITED_STATES = "United States";
export const SOUTH_KOREA = "South Korea";

const countryCodes = [
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "KH",
  "CM",
  "CA",
  "CV",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
] as const;

const usStates: LocalizedOption[] = [
  { value: "AL", en: "Alabama", ko: "Alabama" },
  { value: "AK", en: "Alaska", ko: "Alaska" },
  { value: "AZ", en: "Arizona", ko: "Arizona" },
  { value: "AR", en: "Arkansas", ko: "Arkansas" },
  { value: "CA", en: "California", ko: "California" },
  { value: "CO", en: "Colorado", ko: "Colorado" },
  { value: "CT", en: "Connecticut", ko: "Connecticut" },
  { value: "DE", en: "Delaware", ko: "Delaware" },
  { value: "FL", en: "Florida", ko: "Florida" },
  { value: "GA", en: "Georgia", ko: "Georgia" },
  { value: "HI", en: "Hawaii", ko: "Hawaii" },
  { value: "ID", en: "Idaho", ko: "Idaho" },
  { value: "IL", en: "Illinois", ko: "Illinois" },
  { value: "IN", en: "Indiana", ko: "Indiana" },
  { value: "IA", en: "Iowa", ko: "Iowa" },
  { value: "KS", en: "Kansas", ko: "Kansas" },
  { value: "KY", en: "Kentucky", ko: "Kentucky" },
  { value: "LA", en: "Louisiana", ko: "Louisiana" },
  { value: "ME", en: "Maine", ko: "Maine" },
  { value: "MD", en: "Maryland", ko: "Maryland" },
  { value: "MA", en: "Massachusetts", ko: "Massachusetts" },
  { value: "MI", en: "Michigan", ko: "Michigan" },
  { value: "MN", en: "Minnesota", ko: "Minnesota" },
  { value: "MS", en: "Mississippi", ko: "Mississippi" },
  { value: "MO", en: "Missouri", ko: "Missouri" },
  { value: "MT", en: "Montana", ko: "Montana" },
  { value: "NE", en: "Nebraska", ko: "Nebraska" },
  { value: "NV", en: "Nevada", ko: "Nevada" },
  { value: "NH", en: "New Hampshire", ko: "New Hampshire" },
  { value: "NJ", en: "New Jersey", ko: "New Jersey" },
  { value: "NM", en: "New Mexico", ko: "New Mexico" },
  { value: "NY", en: "New York", ko: "New York" },
  { value: "NC", en: "North Carolina", ko: "North Carolina" },
  { value: "ND", en: "North Dakota", ko: "North Dakota" },
  { value: "OH", en: "Ohio", ko: "Ohio" },
  { value: "OK", en: "Oklahoma", ko: "Oklahoma" },
  { value: "OR", en: "Oregon", ko: "Oregon" },
  { value: "PA", en: "Pennsylvania", ko: "Pennsylvania" },
  { value: "RI", en: "Rhode Island", ko: "Rhode Island" },
  { value: "SC", en: "South Carolina", ko: "South Carolina" },
  { value: "SD", en: "South Dakota", ko: "South Dakota" },
  { value: "TN", en: "Tennessee", ko: "Tennessee" },
  { value: "TX", en: "Texas", ko: "Texas" },
  { value: "UT", en: "Utah", ko: "Utah" },
  { value: "VT", en: "Vermont", ko: "Vermont" },
  { value: "VA", en: "Virginia", ko: "Virginia" },
  { value: "WA", en: "Washington", ko: "Washington" },
  { value: "WV", en: "West Virginia", ko: "West Virginia" },
  { value: "WI", en: "Wisconsin", ko: "Wisconsin" },
  { value: "WY", en: "Wyoming", ko: "Wyoming" },
];

const koreanRegions: LocalizedOption[] = [
  { value: "Seoul", en: "Seoul", ko: "서울" },
  { value: "Busan", en: "Busan", ko: "부산" },
  { value: "Incheon", en: "Incheon", ko: "인천" },
  { value: "Daegu", en: "Daegu", ko: "대구" },
  { value: "Daejeon", en: "Daejeon", ko: "대전" },
  { value: "Gwangju", en: "Gwangju", ko: "광주" },
  { value: "Ulsan", en: "Ulsan", ko: "울산" },
  { value: "Sejong", en: "Sejong", ko: "세종" },
  { value: "Gyeonggi", en: "Gyeonggi", ko: "경기" },
  { value: "Gangwon", en: "Gangwon", ko: "강원" },
  { value: "Chungbuk", en: "Chungbuk", ko: "충북" },
  { value: "Chungnam", en: "Chungnam", ko: "충남" },
  { value: "Jeonbuk", en: "Jeonbuk", ko: "전북" },
  { value: "Jeonnam", en: "Jeonnam", ko: "전남" },
  { value: "Gyeongbuk", en: "Gyeongbuk", ko: "경북" },
  { value: "Gyeongnam", en: "Gyeongnam", ko: "경남" },
  { value: "Jeju", en: "Jeju", ko: "제주" },
  { value: "Other", en: "Other", ko: "기타" },
];

const buyerCategories: LocalizedOption[] = [
  { value: "beauty_personal_care", en: "Beauty & Personal Care", ko: "뷰티 / 퍼스널케어" },
  { value: "food_snacks", en: "Food & Snacks", ko: "식품 / 스낵" },
  { value: "household_goods", en: "Household Goods", ko: "생활용품" },
  { value: "fashion_apparel", en: "Fashion & Apparel", ko: "패션 / 의류" },
  { value: "baby_kids", en: "Baby & Kids", ko: "유아 / 키즈" },
  { value: "pet_products", en: "Pet Products", ko: "반려동물용품" },
  { value: "health_wellness", en: "Health & Wellness", ko: "헬스 / 웰니스" },
  {
    value: "electronics_accessories",
    en: "Electronics Accessories",
    ko: "전자기기 액세서리",
  },
  { value: "kitchenware", en: "Kitchenware", ko: "주방용품" },
  {
    value: "kpop_character_goods",
    en: "K-Pop & Character Goods",
    ko: "K-Pop / 캐릭터 굿즈",
  },
  {
    value: "stationery_lifestyle",
    en: "Stationery & Lifestyle",
    ko: "문구 / 라이프스타일",
  },
  { value: "other", en: "Other", ko: "기타" },
];

const sellerProductCategories: LocalizedOption[] = [
  { value: "Beauty & Personal Care", en: "Beauty & Personal Care", ko: "뷰티 / 퍼스널케어" },
  { value: "Food & Snacks", en: "Food & Snacks", ko: "식품 / 스낵" },
  { value: "Household Goods", en: "Household Goods", ko: "생활용품" },
  { value: "Fashion & Apparel", en: "Fashion & Apparel", ko: "패션 / 의류" },
  { value: "Baby & Kids", en: "Baby & Kids", ko: "유아 / 키즈" },
  { value: "Pet Products", en: "Pet Products", ko: "반려동물용품" },
  { value: "Health & Wellness", en: "Health & Wellness", ko: "헬스 / 웰니스" },
  {
    value: "Electronics Accessories",
    en: "Electronics Accessories",
    ko: "전자기기 액세서리",
  },
  { value: "Kitchenware", en: "Kitchenware", ko: "주방용품" },
  {
    value: "K-Pop & Character Goods",
    en: "K-Pop & Character Goods",
    ko: "K-Pop / 캐릭터 굿즈",
  },
  {
    value: "Stationery & Lifestyle",
    en: "Stationery & Lifestyle",
    ko: "문구 / 라이프스타일",
  },
  { value: "Packaging", en: "Packaging", ko: "패키징" },
  {
    value: "Industrial / B2B Supplies",
    en: "Industrial / B2B Supplies",
    ko: "산업재 / B2B 소모품",
  },
  { value: "Other", en: "Other", ko: "기타" },
];

const supplierTypes: LocalizedOption[] = [
  { value: "manufacturer", en: "Manufacturer", ko: "제조사" },
  { value: "brand_owner", en: "Brand Owner", ko: "브랜드사" },
  {
    value: "distributor_wholesaler",
    en: "Distributor / Wholesaler",
    ko: "유통사 / 도매업체",
  },
  { value: "oem_odm_supplier", en: "OEM / ODM Supplier", ko: "OEM / ODM 공급사" },
  { value: "exporter", en: "Exporter", ko: "수출업체" },
  { value: "any_supplier_type", en: "Any supplier type", ko: "공급사 유형 무관" },
  { value: "not_sure_yet", en: "Not sure yet", ko: "아직 잘 모르겠음" },
];

const sellerSupplierTypes: LocalizedOption[] = [
  { value: "manufacturer", en: "Manufacturer", ko: "제조사" },
  { value: "brand_owner", en: "Brand Owner", ko: "브랜드사" },
  {
    value: "distributor_wholesaler",
    en: "Distributor / Wholesaler",
    ko: "유통사 / 도매업체",
  },
  { value: "exporter", en: "Exporter", ko: "수출업체" },
  { value: "oem_odm_supplier", en: "OEM / ODM Supplier", ko: "OEM / ODM 공급사" },
  { value: "trading_company", en: "Trading Company", ko: "무역회사" },
  {
    value: "fulfillment_logistics_partner",
    en: "Fulfillment / Logistics Partner",
    ko: "풀필먼트 / 물류 파트너",
  },
  { value: "other", en: "Other", ko: "기타" },
];

const moqUnits: LocalizedOption[] = [
  { value: "Units", en: "Units", ko: "개" },
  { value: "Bottles", en: "Bottles", ko: "병" },
  { value: "Boxes", en: "Boxes", ko: "박스" },
  { value: "Cartons", en: "Cartons", ko: "카톤" },
  { value: "Cases", en: "Cases", ko: "케이스" },
  { value: "Packs", en: "Packs", ko: "팩" },
  { value: "Pallets", en: "Pallets", ko: "팔레트" },
  { value: "Kilograms", en: "Kilograms", ko: "kg" },
  { value: "Liters", en: "Liters", ko: "L" },
  { value: "Not fixed", en: "Not fixed", ko: "고정 없음" },
];

const priceUnits: LocalizedOption[] = [
  { value: "unit", en: "unit", ko: "개" },
  { value: "bottle", en: "bottle", ko: "병" },
  { value: "box", en: "box", ko: "박스" },
  { value: "carton", en: "carton", ko: "카톤" },
  { value: "case", en: "case", ko: "케이스" },
  { value: "pack", en: "pack", ko: "팩" },
  { value: "kg", en: "kg", ko: "kg" },
  { value: "liter", en: "liter", ko: "L" },
  { value: "pallet", en: "pallet", ko: "팔레트" },
  { value: "custom", en: "custom", ko: "직접 입력" },
];

const defaultMoqUnit = "Units";

const leadTimes: LocalizedOption[] = [
  { value: "Ready to ship", en: "Ready to ship", ko: "즉시 출고 가능" },
  { value: "1 - 2 weeks", en: "1 - 2 weeks", ko: "1 - 2주" },
  { value: "2 - 4 weeks", en: "2 - 4 weeks", ko: "2 - 4주" },
  { value: "1 - 2 months", en: "1 - 2 months", ko: "1 - 2개월" },
  { value: "2 - 3 months", en: "2 - 3 months", ko: "2 - 3개월" },
  { value: "3+ months", en: "3+ months", ko: "3개월 이상" },
  {
    value: "Depends on order size",
    en: "Depends on order size",
    ko: "주문 규모에 따라 다름",
  },
];

const sampleAvailabilityOptions: LocalizedOption[] = [
  { value: "samples_available", en: "Samples available", ko: "샘플 가능" },
  { value: "paid_samples_available", en: "Paid samples available", ko: "유료 샘플 가능" },
  { value: "samples_not_available", en: "Samples not available", ko: "샘플 불가" },
  { value: "depends_on_product", en: "Depends on product", ko: "상품에 따라 다름" },
];

const privateLabelOptions: LocalizedOption[] = [
  { value: "available", en: "Available", ko: "가능" },
  { value: "not_available", en: "Not available", ko: "불가" },
  { value: "depends_on_order_size", en: "Depends on order size", ko: "주문 규모에 따라 다름" },
];

const incoterms: LocalizedOption[] = [
  { value: "EXW", en: "EXW", ko: "EXW" },
  { value: "FOB", en: "FOB", ko: "FOB" },
  { value: "CIF", en: "CIF", ko: "CIF" },
  { value: "CFR", en: "CFR", ko: "CFR" },
  { value: "DAP", en: "DAP", ko: "DAP" },
  { value: "DDP", en: "DDP", ko: "DDP" },
  { value: "FCA", en: "FCA", ko: "FCA" },
  { value: "not_sure_yet", en: "Not sure yet", ko: "아직 잘 모르겠음" },
];

const sellerDocuments: LocalizedOption[] = [
  { value: "commercial_invoice", en: "Commercial invoice", ko: "상업송장" },
  { value: "packing_list", en: "Packing list", ko: "패킹리스트" },
  { value: "certificate_of_origin", en: "Certificate of Origin", ko: "원산지 증명서" },
  { value: "coa", en: "COA", ko: "COA" },
  { value: "msds", en: "MSDS", ko: "MSDS" },
  { value: "lab_test_report", en: "Lab test report", ko: "시험성적서" },
  { value: "fda_related_documents", en: "FDA-related documents", ko: "FDA 관련 서류" },
  { value: "product_specification_sheet", en: "Product specification sheet", ko: "제품 사양서" },
  { value: "ingredient_list", en: "Ingredient list", ko: "성분표" },
  {
    value: "packaging_labeling_information",
    en: "Packaging / labeling information",
    ko: "패키징 / 라벨링 정보",
  },
  { value: "other", en: "Other", ko: "기타" },
];

const complianceClaims: LocalizedOption[] = [
  { value: "gmp", en: "GMP", ko: "GMP" },
  { value: "haccp", en: "HACCP", ko: "HACCP" },
  { value: "iso", en: "ISO", ko: "ISO" },
  { value: "nsf", en: "NSF", ko: "NSF" },
  {
    value: "fda_registration_information_provided",
    en: "FDA registration information provided",
    ko: "FDA 등록 관련 정보 제공",
  },
  { value: "organic_related_documents", en: "Organic-related documents", ko: "유기농 관련 서류" },
  { value: "vegan_related_documents", en: "Vegan-related documents", ko: "비건 관련 서류" },
  { value: "not_applicable", en: "Not applicable", ko: "해당 없음" },
  { value: "other", en: "Other", ko: "기타" },
];

const orderSizes: LocalizedOption[] = [
  { value: "sample_only", en: "Sample order only", ko: "샘플 주문만" },
  { value: "under_1000", en: "Under $1,000", ko: "$1,000 미만" },
  { value: "1000_5000", en: "$1,000 - $5,000", ko: "$1,000 - $5,000" },
  { value: "5000_10000", en: "$5,000 - $10,000", ko: "$5,000 - $10,000" },
  { value: "10000_50000", en: "$10,000 - $50,000", ko: "$10,000 - $50,000" },
  { value: "50000_plus", en: "$50,000+", ko: "$50,000 이상" },
  { value: "not_sure_yet", en: "Not sure yet", ko: "아직 잘 모르겠음" },
];

const importVolumes: LocalizedOption[] = [
  { value: "no_history", en: "No import history yet", ko: "아직 수입 이력 없음" },
  { value: "under_50000", en: "Under $50,000", ko: "$50,000 미만" },
  { value: "50000_250000", en: "$50,000 - $250,000", ko: "$50,000 - $250,000" },
  { value: "250000_1m", en: "$250,000 - $1M", ko: "$250,000 - $1M" },
  { value: "1m_5m", en: "$1M - $5M", ko: "$1M - $5M" },
  { value: "5m_plus", en: "$5M+", ko: "$5M 이상" },
  { value: "prefer_not_to_say", en: "Prefer not to say", ko: "공개하지 않음" },
];

const importExperiences: LocalizedOption[] = [
  { value: "first_time", en: "First-time importer", ko: "첫 수입 준비 중" },
  { value: "some_experience", en: "Some import experience", ko: "수입 경험 조금 있음" },
  { value: "experienced", en: "Experienced importer", ko: "수입 경험 많음" },
  {
    value: "working_with_overseas_suppliers",
    en: "Currently working with overseas suppliers",
    ko: "현재 해외 공급사와 거래 중",
  },
  { value: "need_guidance", en: "Need guidance", ko: "수입 절차 안내가 필요함" },
];

const salesChannels: LocalizedOption[] = [
  { value: "amazon", en: "Amazon", ko: "Amazon" },
  { value: "walmart_marketplace", en: "Walmart Marketplace", ko: "Walmart Marketplace" },
  { value: "shopify_own_website", en: "Shopify / Own website", ko: "Shopify / 자체 웹사이트" },
  { value: "tiktok_shop", en: "TikTok Shop", ko: "TikTok Shop" },
  {
    value: "instagram_social_commerce",
    en: "Instagram / Social commerce",
    ko: "Instagram / 소셜커머스",
  },
  { value: "retail_store", en: "Retail store", ko: "오프라인 리테일 매장" },
  { value: "wholesale_distribution", en: "Wholesale / Distribution", ko: "도매 / 유통" },
  { value: "specialty_store", en: "Specialty store", ko: "전문 매장" },
  {
    value: "restaurant_cafe_offline",
    en: "Restaurant / Cafe / Offline business",
    ko: "식당 / 카페 / 오프라인 사업장",
  },
  {
    value: "gyms_wellness_retailers",
    en: "Gyms / wellness retailers",
    ko: "짐 / 웰니스 리테일러",
  },
  { value: "other", en: "Other", ko: "기타" },
];

const sourcingTimelines: LocalizedOption[] = [
  { value: "immediately", en: "Immediately", ko: "바로 진행 가능" },
  { value: "within_1_month", en: "Within 1 month", ko: "1개월 이내" },
  { value: "1_3_months", en: "1 - 3 months", ko: "1 - 3개월" },
  { value: "3_6_months", en: "3 - 6 months", ko: "3 - 6개월" },
  { value: "6_plus_months", en: "6+ months", ko: "6개월 이상" },
  { value: "researching_only", en: "Researching only", ko: "아직 시장조사 중" },
];

const buyerTypes: LocalizedOption[] = [
  { value: "importer", en: "Importer", ko: "수입업체" },
  { value: "distributor", en: "Distributor", ko: "유통사" },
  { value: "retailer", en: "Retailer", ko: "리테일러" },
  { value: "online_seller", en: "Online seller", ko: "온라인 셀러" },
  { value: "wholesaler", en: "Wholesaler", ko: "도매업체" },
];

const sellerCompanyTypes: LocalizedOption[] = [
  ...sellerSupplierTypes,
];

function localized(options: LocalizedOption[], locale: OptionLocale): SelectOption[] {
  return options.map((option) => ({
    value: option.value,
    label: locale === "ko" ? option.ko : option.en,
  }));
}

function countryName(code: string, locale: OptionLocale) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const englishCountryNames = new Intl.DisplayNames(["en"], { type: "region" });

function englishCountryValue(code: string) {
  return englishCountryNames.of(code) ?? code;
}

function labelFor(options: LocalizedOption[], value: string | undefined, locale: OptionLocale) {
  if (!value) return "";
  return localized(options, locale).find((option) => option.value === value)?.label ?? value;
}

export function getUsStateOptions(locale: OptionLocale) {
  return localized(usStates, locale);
}

export function getKoreanRegionOptions(locale: OptionLocale) {
  return localized(koreanRegions, locale);
}

export function getCountryOptions(locale: OptionLocale) {
  return countryCodes
    .map((code) => ({
      value: englishCountryValue(code),
      label: countryName(code, locale),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function getCountryCodeOptions(locale: OptionLocale) {
  return countryCodes
    .map((code) => ({
      value: code,
      label: countryName(code, locale),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function getBuyerCategoryOptions(locale: OptionLocale) {
  return localized(buyerCategories, locale);
}

export function getSellerProductCategoryOptions(locale: OptionLocale) {
  return localized(sellerProductCategories, locale);
}

export function getSupplierTypeOptions(locale: OptionLocale) {
  return localized(supplierTypes, locale);
}

export function getSellerSupplierTypeOptions(locale: OptionLocale) {
  return localized(sellerSupplierTypes, locale);
}

export function getMoqUnitOptions(locale: OptionLocale) {
  return localized(moqUnits, locale);
}

export function getPriceUnitOptions(locale: OptionLocale) {
  return localized(priceUnits, locale);
}

export function getLeadTimeOptions(locale: OptionLocale) {
  return localized(leadTimes, locale);
}

export function getSampleAvailabilityOptions(locale: OptionLocale) {
  return localized(sampleAvailabilityOptions, locale);
}

export function getPrivateLabelOptions(locale: OptionLocale) {
  return localized(privateLabelOptions, locale);
}

export function getIncotermOptions(locale: OptionLocale) {
  return localized(incoterms, locale);
}

export function getSellerDocumentOptions(locale: OptionLocale) {
  return localized(sellerDocuments, locale);
}

export function getComplianceClaimOptions(locale: OptionLocale) {
  return localized(complianceClaims, locale);
}

export function getOrderSizeOptions(locale: OptionLocale) {
  return localized(orderSizes, locale);
}

export function getImportVolumeOptions(locale: OptionLocale) {
  return localized(importVolumes, locale);
}

export function getImportExperienceOptions(locale: OptionLocale) {
  return localized(importExperiences, locale);
}

export function getSalesChannelOptions(locale: OptionLocale) {
  return localized(salesChannels, locale);
}

export function getSourcingTimelineOptions(locale: OptionLocale) {
  return localized(sourcingTimelines, locale);
}

export function getBuyerTypeOptions(locale: OptionLocale) {
  return localized(buyerTypes, locale);
}

export function getSellerCompanyTypeOptions(locale: OptionLocale) {
  return localized(sellerCompanyTypes, locale);
}

export function buyerCategoryLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(buyerCategories, value, locale);
}

export function sellerProductCategoryLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sellerProductCategories, value, locale);
}

export function supplierTypeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(supplierTypes, value, locale);
}

export function sellerSupplierTypeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sellerSupplierTypes, normalizeSellerSupplierType(value), locale);
}

export function moqUnitLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(moqUnits, value, locale);
}

export function priceUnitLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(priceUnits, value, locale);
}

export function parseMoqValue(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return { quantity: "", unit: defaultMoqUnit };

  const knownUnit = moqUnits.find(
    (option) => option.value.toLowerCase() === raw.toLowerCase(),
  );
  if (knownUnit) {
    return { quantity: "", unit: knownUnit.value };
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return { quantity: raw.replace(/[^\d.]/g, ""), unit: defaultMoqUnit };

  const [, quantity, unitText] = match;
  const unit =
    moqUnits.find(
      (option) => option.value.toLowerCase() === unitText.trim().toLowerCase(),
    )?.value ?? defaultMoqUnit;

  return { quantity, unit };
}

export function formatMoqValue(quantity: string, unit: string) {
  const normalizedUnit =
    moqUnits.find((option) => option.value === unit)?.value ?? defaultMoqUnit;
  const cleanQuantity = quantity.replace(/[^\d.]/g, "").trim();
  if (normalizedUnit === "Not fixed" && !cleanQuantity) return "Not fixed";
  if (!cleanQuantity) return "";
  return `${cleanQuantity} ${normalizedUnit}`;
}

export function leadTimeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(leadTimes, value, locale);
}

export function sampleAvailabilityLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sampleAvailabilityOptions, value, locale);
}

export function privateLabelAvailabilityLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(privateLabelOptions, value, locale);
}

export function incotermLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(incoterms, value, locale);
}

export function sellerDocumentLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sellerDocuments, value, locale);
}

export function complianceClaimLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(complianceClaims, value, locale);
}

export function orderSizeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(orderSizes, value, locale);
}

export function importVolumeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(importVolumes, value, locale);
}

export function importExperienceLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(importExperiences, value, locale);
}

export function salesChannelLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(salesChannels, value, locale);
}

export function sourcingTimelineLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sourcingTimelines, value, locale);
}

export function buyerTypeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(buyerTypes, value, locale);
}

export function sellerCompanyTypeLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(sellerCompanyTypes, normalizeSellerSupplierType(value), locale);
}

export function normalizeSellerSupplierType(value: string | undefined) {
  if (value === "factory") return "manufacturer";
  if (value === "distributor" || value === "wholesaler") return "distributor_wholesaler";
  return value ?? "";
}

export function stateLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(usStates, value, locale);
}

export function koreanRegionLabel(value: string | undefined, locale: OptionLocale) {
  return labelFor(koreanRegions, value, locale);
}

export function countryLabel(value: string | undefined, locale: OptionLocale) {
  const option = getCountryOptions(locale).find((country) => country.value === value);
  if (option) return option.label;
  if (value === UNITED_STATES) return locale === "ko" ? "미국" : UNITED_STATES;
  if (value === SOUTH_KOREA) return locale === "ko" ? "대한민국" : SOUTH_KOREA;
  return value ?? "";
}

export function optionLabels(
  values: string[] | undefined,
  labeler: (value: string, locale: OptionLocale) => string,
  locale: OptionLocale,
) {
  return (values ?? []).map((value) => labeler(value, locale)).filter(Boolean);
}
