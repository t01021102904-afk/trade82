import type { Locale } from "@/lib/i18n";

export function localizedText({
  locale,
  original,
  english,
}: {
  locale: Locale;
  original: unknown;
  english: unknown;
}) {
  const originalText = String(original ?? "").trim();
  const englishText = String(english ?? "").trim();

  return locale === "en"
    ? englishText || originalText
    : originalText || englishText;
}

export function localizedArray({
  locale,
  original,
  english,
}: {
  locale: Locale;
  original: unknown;
  english: unknown;
}) {
  const originalItems = arrayOfStrings(original);
  const englishItems = arrayOfStrings(english);

  return locale === "en"
    ? englishItems.length ? englishItems : originalItems
    : originalItems.length ? originalItems : englishItems;
}

export function localizedCompanyName(
  company: Record<string, unknown>,
  locale: Locale,
) {
  if (locale === "en") {
    return (
      String(company.displayNameEn ?? "").trim() ||
      String(company.tradeName ?? "").trim() ||
      String(company.legalName ?? "").trim()
    );
  }

  return (
    String(company.tradeName ?? "").trim() ||
    String(company.legalName ?? "").trim() ||
    String(company.displayNameEn ?? "").trim()
  );
}

export function localizedCompanyDescription(
  company: Record<string, unknown>,
  locale: Locale,
) {
  return localizedText({
    locale,
    original: company.description,
    english: company.descriptionEn,
  });
}

export function localizedSellerExportExperience(
  profile: Record<string, unknown> | null | undefined,
  locale: Locale,
) {
  return localizedText({
    locale,
    original: profile?.exportExperience,
    english: profile?.exportExperienceEn,
  });
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
