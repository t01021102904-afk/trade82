"use client";

import { useUser } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
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
      const items = (await response.json()) as Array<{ targetId?: string }>;
      const result = new Set(
        items.flatMap((item) => (item.targetId ? [item.targetId] : [])),
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
  kind: "product" | "company";
  className?: string;
  iconOnly?: boolean;
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const interacted = useRef(false);
  const redirecting = useRef(false);

  useEffect(() => {
    interacted.current = false;
    if (!isSignedIn || !user) return;
    let active = true;
    void loadSavedItems(user.id).then((items) => {
      if (active) {
        if (!interacted.current) {
          setSaved(items.has(id));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [id, isSignedIn, kind, user]);

  async function toggleSave() {
    if (!isLoaded || pending) return;
    if (!isSignedIn) {
      if (redirecting.current) return;
      redirecting.current = true;
      const loginPath = withLocale("/login", locale);
      const currentUrl = `${pathname}${window.location.search}`;
      window.location.assign(
        `${loginPath}?redirect_url=${encodeURIComponent(currentUrl)}`,
      );
      return;
    }

    interacted.current = true;
    const previous = saved;
    const optimistic = !previous;
    setSaved(optimistic);
    setPending(true);
    setFeedback(optimistic ? t("common.saved") : t("common.removed"));

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
        if (user) {
          const cached = savedItemsByUser.get(user.id) ?? new Set<string>();
          if (result.saved) cached.add(id);
          else cached.delete(id);
          savedItemsByUser.set(user.id, cached);
        }
        setFeedback(
          result.saved ? t("common.saved") : t("common.removed"),
        );
      }
    } catch {
      setSaved(previous);
      setFeedback(t("common.saveError"));
    } finally {
      setPending(false);
      window.setTimeout(() => setFeedback(""), 1800);
    }
  }

  const label = saved
    ? t("common.saved")
    : kind === "product"
      ? t("common.saveProduct")
      : t("common.saveCompany");
  const role = user?.publicMetadata.role;
  if (
    isSignedIn &&
    role !== "buyer" &&
    role !== "both"
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
          void toggleSave();
        }}
        disabled={!isLoaded || pending}
        className={cx(
          "inline-flex min-h-11 w-full items-center justify-center rounded-md border text-sm font-medium transition disabled:cursor-wait disabled:opacity-70",
          iconOnly ? "min-w-11 p-2.5" : "px-3.5 py-2",
          saved
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700",
        )}
        aria-label={label}
        aria-pressed={saved}
        title={label}
      >
        {iconOnly ? (
          <Heart
            className={cx("size-5", saved && "fill-current")}
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
