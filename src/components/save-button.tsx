"use client";

import { Heart } from "lucide-react";
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
  const [feedback, setFeedback] = useState("");
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
  const savedFeedback = t("common.saved");
  const removedFeedback = t("common.removed");

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
    setFeedback(optimistic ? savedFeedback : removedFeedback);

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
        setFeedback(result?.error || t("common.saveError"));
      } else {
        setSaved(result.saved);
        if (userId) {
          const cached = savedItemsByUser.get(userId) ?? new Set<string>();
          if (result.saved) cached.add(id);
          else cached.delete(id);
          savedItemsByUser.set(userId, cached);
        }
        setFeedback(result.saved ? savedFeedback : removedFeedback);
      }
    } catch {
      setSaved(previous);
      setFeedback(t("common.saveError"));
    } finally {
      setPending(false);
      window.setTimeout(() => setFeedback(""), 1800);
    }
  }, [
    id,
    isSignedIn,
    kind,
    pending,
    redirectToLogin,
    removedFeedback,
    saved,
    savedFeedback,
    t,
    userId,
  ]);

  useEffect(() => {
    if (!queuedToggle.current || pending || !isLoaded) return;
    if (isSignedIn && canUseSavedItems && !savedItemsReady) return;

    queuedToggle.current = false;
    queueMicrotask(() => {
      setWaitingForSession(false);
      setFeedback("");
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
      setFeedback(t("common.loading"));
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
        className={cx(
          "inline-flex min-h-11 w-full items-center justify-center rounded-md border text-sm font-medium transition disabled:cursor-wait disabled:opacity-70",
          iconOnly ? "min-w-11 p-2.5" : "px-3.5 py-2",
          visibleSaved
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700",
        )}
        aria-label={label}
        aria-pressed={visibleSaved}
        title={label}
      >
        {iconOnly ? (
          <Heart
            className={cx("size-5", visibleSaved && "fill-current")}
            aria-hidden="true"
          />
        ) : (
          label
        )}
      </button>
      {feedback ? (
        <span
          role="status"
          className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-950 px-2 py-1 text-xs text-white shadow"
        >
          {feedback}
        </span>
      ) : null}
    </div>
  );
}
