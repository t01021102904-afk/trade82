"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DraftEnvelope<T> = {
  savedAt: string;
  value: T;
};

function readDraft<T>(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useUnsavedChangesWarning(enabled: boolean, message: string) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    const handleInternalLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) {
        return;
      }

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search &&
        nextUrl.hash
      ) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleInternalLinkClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleInternalLinkClick, true);
    };
  }, [enabled, message]);

  return useCallback(() => {
    if (!enabled) return true;
    return window.confirm(message);
  }, [enabled, message]);
}

export function useDraftBackup<T>(key: string, value: T, enabled: boolean) {
  const storedDraft = useMemo(() => readDraft<T>(key), [key]);
  const [dismissedKey, setDismissedKey] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        value,
      } satisfies DraftEnvelope<T>),
    );
  }, [enabled, key, value]);

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    setDismissedKey(key);
  }, [key]);

  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return {
    draft: dismissedKey === key ? null : storedDraft?.value ?? null,
    draftSavedAt:
      dismissedKey === key ? "" : storedDraft?.savedAt ?? "",
    clearDraft,
    discardDraft,
  };
}
