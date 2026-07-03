"use client";

import {
  Check,
  Copy,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Send,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

type ProductShareButtonProps = {
  title: string;
  description: string;
  imageUrl?: string;
  className?: string;
};

const copy = {
  en: {
    button: "Share",
    title: "Share product",
    close: "Close share dialog",
    copy: "Copy",
    copied: "Copied",
    copyLink: "Copy Link",
    linkLabel: "Product link",
    unavailable: "Product link will be available after the page loads.",
  },
  ko: {
    button: "공유",
    title: "상품 공유",
    close: "공유 창 닫기",
    copy: "복사",
    copied: "복사됨",
    copyLink: "링크 복사",
    linkLabel: "상품 링크",
    unavailable: "페이지가 로드되면 상품 링크를 사용할 수 있습니다.",
  },
} as const;

export function ProductShareButton({
  title,
  description,
  imageUrl,
  className,
}: ProductShareButtonProps) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const resolvedImageUrl = useMemo(() => {
    const candidate = imageUrl?.trim() || "/og/trade82-share.png";
    try {
      return new URL(candidate).toString();
    } catch {
      const base =
        shareUrl ||
        (typeof window !== "undefined" ? window.location.origin : "https://trade82.com");
      return new URL(candidate, base).toString();
    }
  }, [imageUrl, shareUrl]);

  const shareTargets = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedTitleAndUrl = encodeURIComponent(`${title} ${shareUrl}`);
    const encodedImage = encodeURIComponent(resolvedImageUrl);
    const encodedDescription = encodeURIComponent(description || title);

    return [
      {
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodedTitleAndUrl}`,
        icon: MessageCircle,
      },
      {
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        icon: Share2,
      },
      {
        label: "X",
        href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
        icon: X,
      },
      {
        label: "Email",
        href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
        icon: Mail,
      },
      {
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        icon: LinkIcon,
      },
      {
        label: "Reddit",
        href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
        icon: Send,
      },
      {
        label: "Pinterest",
        href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImage}&description=${encodedDescription}`,
        icon: Share2,
      },
    ];
  }, [description, resolvedImageUrl, shareUrl, title]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShareUrl(window.location.href);
          setOpen(true);
        }}
        className={cx(
          "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition theme-secondary-button hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)]",
          className,
        )}
      >
        <Share2 className="size-4" aria-hidden />
        {text.button}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-share-title"
            className="w-full max-w-lg rounded-2xl border p-4 shadow-2xl theme-surface-elevated sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="product-share-title" className="text-lg font-semibold theme-foreground">
                  {text.title}
                </h2>
                <p className="mt-1 truncate text-sm theme-muted">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full theme-ghost-button"
                aria-label={text.close}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {shareTargets.map((target) => {
                const Icon = target.icon;
                return (
                  <a
                    key={target.label}
                    href={shareUrl ? target.href : "#"}
                    target={target.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={target.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                    onClick={(event) => {
                      if (!shareUrl) event.preventDefault();
                    }}
                    className="group grid min-h-20 place-items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition theme-surface-muted hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)]"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-full border theme-surface">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {target.label}
                  </a>
                );
              })}
              <button
                type="button"
                onClick={() => void copyLink()}
                disabled={!shareUrl}
                className="group grid min-h-20 place-items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition theme-surface-muted hover:border-[var(--accent-foreground)] hover:text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full border theme-surface">
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                </span>
                {copied ? text.copied : text.copyLink}
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <label htmlFor="product-share-url" className="text-xs font-medium theme-muted">
                {text.linkLabel}
              </label>
              <div className="flex gap-2 rounded-xl border p-1.5 theme-surface-muted">
                <input
                  id="product-share-url"
                  value={shareUrl || text.unavailable}
                  readOnly
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none theme-foreground"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  disabled={!shareUrl}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold theme-primary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied ? text.copied : text.copy}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
