"use client";



import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";
import { cx } from "@/lib/utils";

const savedItemsByUser = new Map<string, Set<string>>();
const savedItemsRequests = new Map<string, Promise<Set<string>>>();

function loadSavedItems(userId: string) {
  const cached = savedItemsByUser.get(userId);
  if (cached) return Promise.resolve(cached);
  const pending = savedItemsRequests.get(userId);
  if (pending) return pending;
  const request = fetch("/api/saved-items")
    .then(async (response) => {
      if (!response.ok) return new Set<string>();
      const items = (await response.json()) as Array<{
        targetId?: string;
        type?: string;
      }>;
      const result = new Set(
        items.flatMap((item) =>
          item.type === "product" && item.targetId ? [item.targetId] : [],
        ),
      );
      savedItemsByUser.set(userId, result);
      return result;
    })
    .finally(() => savedItemsRequests.delete(userId));
  savedItemsRequests.set(userId, request);
  return request;
}

export function SaveButton({
  id,
  kind,
  className,
  iconOnly = false,
}: {
  id: string;
  kind: "product";
  className?: string;
  iconOnly?: boolean;
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { context: userContext, isLoaded, isSignedIn, user } = useUserContext();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [loadedSavedKey, setLoadedSavedKey] = useState("");
  const interacted = useRef(false);
  const queuedToggle = useRef(false);
  const redirecting = useRef(false);
  const role = user?.publicMetadata.role;
  const canUseSavedItems =
    role === "buyer" ||
    role === "both" ||
    role === "admin" ||
    userContext?.isAdmin === true;
  const userId = isSignedIn && canUseSavedItems ? user?.id : "";
  const savedItemsKey = userId ? `${userId}:${id}` : "";
  const savedItemsReady = !userId || loadedSavedKey === savedItemsKey;

  useEffect(() => {
    interacted.current = false;
    if (!userId) return;
    let active = true;
    void loadSavedItems(userId).then((items) => {
      if (active) {
        if (!interacted.current) {
          setSaved(items.has(id));
        }
        setLoadedSavedKey(savedItemsKey);
      }
    });
    return () => {
      active = false;
    };
  }, [id, isSignedIn, savedItemsKey, userId]);

  const redirectToLogin = useCallback(() => {
    if (redirecting.current) return;
    redirecting.current = true;
    const loginPath = withLocale("/login", locale);
    const currentUrl = safeInternalPath(`${pathname}${window.location.search}`, "/");
    window.location.assign(
      `${loginPath}?redirect_url=${encodeURIComponent(currentUrl)}`,
    );
  }, [locale, pathname]);

  const toggleSave = useCallback(async () => {
    if (pending) return;
    if (!isSignedIn) {
      redirectToLogin();
      return;
    }

    interacted.current = true;
    const previous = saved;
    const optimistic = !previous;
    setSaved(optimistic);
    setPending(true);

    try {
      const response = await fetch("/api/saved-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: kind }),
      });
      const result = (await response.json().catch(() => null)) as
        | { saved?: boolean; error?: string }
        | null;
      if (!response.ok || typeof result?.saved !== "boolean") {
        setSaved(previous);
      } else {
        setSaved(result.saved);
        if (userId) {
          const cached = savedItemsByUser.get(userId) ?? new Set<string>();
          if (result.saved) cached.add(id);
          else cached.delete(id);
          savedItemsByUser.set(userId, cached);
        }
      }
    } catch {
      setSaved(previous);
    } finally {
      setPending(false);
    }
  }, [
    id,
    isSignedIn,
    kind,
    pending,
    redirectToLogin,
    saved,
    t,
    userId,
  ]);

  useEffect(() => {
    if (!queuedToggle.current || pending || !isLoaded) return;
    if (isSignedIn && canUseSavedItems && !savedItemsReady) return;

    queuedToggle.current = false;
    queueMicrotask(() => {
      setWaitingForSession(false);
      void toggleSave();
    });
  }, [
    canUseSavedItems,
    isLoaded,
    isSignedIn,
    pending,
    savedItemsReady,
    toggleSave,
  ]);

  function requestToggle() {
    if (pending || waitingForSession) return;

    if (!isLoaded || (isSignedIn && canUseSavedItems && !savedItemsReady)) {
      queuedToggle.current = true;
      setWaitingForSession(true);
      return;
    }

    void toggleSave();
  }

  const visibleSaved = isSignedIn && canUseSavedItems ? saved : false;
  const label = visibleSaved ? t("common.saved") : t("common.saveProduct");
  if (
    isSignedIn &&
    !canUseSavedItems
  ) {
    return null;
  }

  return (
    <div className={cx(iconOnly ? "" : "relative", className)}>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          requestToggle();
        }}
        disabled={pending || waitingForSession}
        className={cx(cx(
          "inline-flex min-h-10 w-full items-center justify-center rounded-md border text-sm font-medium transition disabled:cursor-wait disabled:opacity-70",
          iconOnly ? "min-w-10 p-2.5" : "px-3.5 py-2",
          visibleSaved
            ? "border-[#34B386] bg-[#34B386]/10 text-zinc-950"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-[#34B386] hover:text-zinc-950",
        ), "!border-0 !bg-transparent !p-0 !shadow-none !ring-0 !outline-none hover:!bg-transparent focus:!ring-0 focus-visible:!ring-0 focus-visible:!outline-none disabled:!opacity-100")}
        aria-label={label}
        aria-pressed={visibleSaved}



      data-icon-only={iconOnly ? "true" : "false"}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        background: "transparent",
        border: 0,
        boxShadow: "none",
        outline: "none",
        padding: 0,
      }}
      data-save-icon-only="true">
        <AnimatedBookmarkIcon saved={Boolean(saved)} />
      </button>
    </div>
  );
}

function AnimatedBookmarkIcon({ saved }: { saved: boolean }) {
  return (
    <motion.svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      initial={false}
      animate={
        saved
          ? {
              scale: [1, 1.24, 0.96, 1],
              y: [0, -2, 0, 0],
              rotate: [0, -5, 3, 0],
            }
          : {
              scale: [1, 0.9, 1],
              y: 0,
              rotate: 0,
            }
      }
      whileTap={{ scale: 0.82 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
      aria-hidden="true"
    >
      <path
        d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}
