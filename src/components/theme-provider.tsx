"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "trade82-theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeListeners = new Set<() => void>();
const serverSnapshot = "system:dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme) {
  return preference === "system" ? systemTheme : preference;
}

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function getStoredPreference() {
  if (typeof window === "undefined") return "system";
  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedPreference) ? storedPreference : "system";
}

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getThemeSnapshot() {
  return `${getStoredPreference()}:${getSystemTheme()}`;
}

function subscribeTheme(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  themeListeners.add(listener);
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = () => emitThemeChange();
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) emitThemeChange();
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    themeListeners.delete(listener);
    mediaQuery.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => serverSnapshot,
  );
  const [snapshotPreference, snapshotSystemTheme] = snapshot.split(":");
  const preference: ThemePreference = isThemePreference(snapshotPreference)
    ? snapshotPreference
    : "system";
  const systemTheme: ResolvedTheme =
    snapshotSystemTheme === "light" ? "light" : "dark";
  const resolvedTheme = resolveTheme(preference, systemTheme);

  useEffect(() => {
    applyTheme(preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    applyTheme(nextPreference, resolveTheme(nextPreference, getSystemTheme()));
    emitThemeChange();
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    return {
      preference: "system" as const,
      resolvedTheme: "dark" as const,
      setPreference: () => undefined,
    };
  }

  return value;
}
