import { countryCodes, type OptionLocale } from "@/lib/company-select-options";

export type NormalizedCountry = {
  code: string | null;
  label: string;
  original: string;
};

const englishNames = new Intl.DisplayNames(["en"], { type: "region" });

const canonicalLabelOverrides: Record<string, string> = {
  GB: "United Kingdom",
  HK: "Hong Kong",
  KR: "South Korea",
  US: "United States",
};

const aliasesByCode: Record<string, readonly string[]> = {
  AE: ["AE", "UAE", "United Arab Emirates"],
  GB: ["GB", "UK", "United Kingdom"],
  HK: [
    "HK",
    "Hong Kong",
    "Hong Kong(China)",
    "Hong Kong (China)",
    "Hong Kong, China",
  ],
  KR: ["KR", "South Korea", "Korea, South", "Republic of Korea"],
  US: ["US", "U.S.", "USA", "U.S.A.", "United States", "United States of America"],
};

export function countryLookupKey(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function englishLabel(code: string) {
  return canonicalLabelOverrides[code] ?? englishNames.of(code) ?? code;
}

const codeByLookupKey = new Map<string, string>();

for (const code of countryCodes) {
  codeByLookupKey.set(countryLookupKey(code), code);
  codeByLookupKey.set(countryLookupKey(englishLabel(code)), code);
}

for (const [code, aliases] of Object.entries(aliasesByCode)) {
  for (const alias of aliases) {
    codeByLookupKey.set(countryLookupKey(alias), code);
  }
}

export function normalizeCountry(value: string | null | undefined): NormalizedCountry {
  const original = value?.trim() ?? "";
  if (!original) return { code: null, label: "", original: "" };

  const code = codeByLookupKey.get(countryLookupKey(original)) ?? null;
  return {
    code,
    label: code ? englishLabel(code) : original,
    original,
  };
}

export function localizedCountryLabel(
  value: string | null | undefined,
  locale: OptionLocale,
) {
  const country = normalizeCountry(value);
  if (!country.code) return country.label;

  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(country.code) ??
      country.label
    );
  } catch {
    return country.label;
  }
}

export function countryLookupKeys(value: string) {
  const country = normalizeCountry(value);
  if (!country.code) return [countryLookupKey(country.original)].filter(Boolean);

  const aliases = aliasesByCode[country.code] ?? [
    country.code,
    englishLabel(country.code),
  ];
  return [...new Set(aliases.map(countryLookupKey).filter(Boolean))];
}

export function normalizeCountryList(values: readonly string[]) {
  const countries = new Map<string, NormalizedCountry>();

  for (const value of values) {
    const country = normalizeCountry(value);
    if (!country.label) continue;
    const key = country.code ?? countryLookupKey(country.label);
    if (!countries.has(key)) countries.set(key, country);
  }

  return [...countries.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en"),
  );
}
