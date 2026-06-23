import en from "../../messages/en.json";
import ko from "../../messages/ko.json";

export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];
export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = { en, ko };

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "ko";
}

export function getDictionary(locale: string | undefined = "en") {
  return dictionaries[isLocale(locale) ? locale : "en"];
}

export function getLocaleFromPathname(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : "en";
}

export function stripLocale(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (isLocale(parts[0])) {
    const stripped = `/${parts.slice(1).join("/")}`;
    return stripped === "/" ? "/" : stripped.replace(/\/$/, "") || "/";
  }

  return pathname || "/";
}

export function withLocale(pathname: string, locale: Locale) {
  const stripped = stripLocale(pathname);
  return locale === "en" ? stripped : `/${locale}${stripped === "/" ? "" : stripped}`;
}

export function getNestedMessage(messages: Messages, key: string) {
  return key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, messages);
}

export function createTranslator(messages: Messages) {
  return (key: string, fallback?: string) => {
    const value = getNestedMessage(messages, key);
    return typeof value === "string" ? value : fallback ?? key;
  };
}
