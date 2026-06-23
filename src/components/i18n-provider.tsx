"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";

import {
  createTranslator,
  getDictionary,
  getLocaleFromPathname,
  type Locale,
  type Messages,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const messages = getDictionary(locale);
  const value = useMemo(
    () => ({
      locale,
      messages,
      t: createTranslator(messages),
    }),
    [locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    return {
      locale: "en" as const,
      messages: getDictionary("en"),
      t: createTranslator(getDictionary("en")),
    };
  }

  return value;
}
