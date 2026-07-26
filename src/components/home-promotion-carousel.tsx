"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";

import { useI18n } from "@/components/i18n-provider";
import { cx } from "@/lib/utils";

export type PublicHomepagePromotion = {
  id: string;
  altText: string;
  mediaType: "IMAGE" | "PDF";
  thumbnailUrl: string;
  destinationUrl: string | null;
  openInNewTab: boolean;
  displayOrder: number;
};

const AUTOPLAY_INTERVAL_MS = 3_000;
const TRANSITION_MS = 650;

export function HomePromotionCarousel({
  promotions,
}: {
  promotions: PublicHomepagePromotion[];
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressLinkClick = useRef(false);
  const multiple = promotions.length > 1;
  const autoplayPaused =
    pausedByUser ||
    hovered ||
    focusWithin ||
    !pageVisible ||
    reducedMotion ||
    !multiple;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const move = useCallback(
    (offset: number) => {
      if (!promotions.length) return;
      setIndex((current) => (current + offset + promotions.length) % promotions.length);
    },
    [promotions.length],
  );

  useEffect(() => {
    if (autoplayPaused) return;
    const timer = window.setInterval(() => move(1), AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, index, move]);

  if (!promotions.length) return null;
  const current = Math.min(index, promotions.length - 1);

  const onFocus = () => setFocusWithin(true);
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusWithin(false);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    suppressLinkClick.current = false;
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !multiple) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    suppressLinkClick.current = true;
    move(deltaX < 0 ? 1 : -1);
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={t("home.carousel.label")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="relative min-w-0 touch-pan-y"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm">
        {promotions.map((promotion, slideIndex) => {
          const active = slideIndex === current;
          const destination = safeDestination(promotion.destinationUrl);
          const content = (
            <div
              role="group"
              aria-roledescription="slide"
              aria-label={t("home.carousel.position")
                .replace("{current}", String(slideIndex + 1))
                .replace("{total}", String(promotions.length))}
              aria-hidden={!active}
              className={cx(
                "absolute inset-0 transition-[opacity,transform] ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "z-10 translate-x-0 opacity-100"
                  : "pointer-events-none z-0 translate-x-[3%] opacity-0",
              )}
              style={{
                transitionDuration: reducedMotion ? "0ms" : `${TRANSITION_MS}ms`,
              }}
            >
              {brokenImages.has(promotion.id) ? (
                <div className="grid size-full place-items-center bg-zinc-100 px-6 text-center text-sm font-medium text-zinc-500">
                  {promotion.altText}
                </div>
              ) : (
                <Image
                  src={promotion.thumbnailUrl}
                  alt={promotion.altText}
                  fill
                  unoptimized
                  priority={slideIndex === 0}
                  sizes="(max-width: 1023px) 100vw, 45vw"
                  onError={() =>
                    setBrokenImages((currentBroken) => {
                      const next = new Set(currentBroken);
                      next.add(promotion.id);
                      return next;
                    })
                  }
                  className={
                    promotion.mediaType === "PDF"
                      ? "object-contain"
                      : "object-cover"
                  }
                />
              )}
            </div>
          );

          if (!destination) return <div key={promotion.id}>{content}</div>;
          const sharedLinkProps = {
            onClick: (event: React.MouseEvent) => {
              if (suppressLinkClick.current) {
                event.preventDefault();
                suppressLinkClick.current = false;
              }
            },
            className: "absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#34B386]",
            tabIndex: active ? 0 : -1,
            "aria-hidden": !active,
          } as const;

          return destination.external ? (
            <a
              key={promotion.id}
              href={destination.href}
              target="_blank"
              rel="noopener noreferrer"
              {...sharedLinkProps}
            >
              {content}
            </a>
          ) : (
            <Link
              key={promotion.id}
              href={destination.href}
              target={promotion.openInNewTab ? "_blank" : undefined}
              rel={promotion.openInNewTab ? "noopener noreferrer" : undefined}
              {...sharedLinkProps}
            >
              {content}
            </Link>
          );
        })}

        {multiple ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={t("home.carousel.previous")}
              className="absolute left-2 top-1/2 z-20 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-zinc-900 shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={t("home.carousel.next")}
              className="absolute right-2 top-1/2 z-20 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-zinc-900 shadow-sm backdrop-blur hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {multiple ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPausedByUser((paused) => !paused)}
            aria-label={
              pausedByUser
                ? t("home.carousel.play")
                : t("home.carousel.pause")
            }
            className="inline-flex size-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/50"
          >
            {pausedByUser ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
          </button>
          <div className="flex items-center gap-1.5">
            {promotions.map((promotion, slideIndex) => (
              <button
                key={promotion.id}
                type="button"
                onClick={() => setIndex(slideIndex)}
                aria-label={t("home.carousel.goTo")
                  .replace("{current}", String(slideIndex + 1))
                  .replace("{total}", String(promotions.length))}
                aria-current={slideIndex === current ? "true" : undefined}
                className={cx(
                  "size-2.5 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34B386]/60 focus-visible:ring-offset-2",
                  slideIndex === current
                    ? "border-zinc-950 bg-zinc-950"
                    : "border-zinc-400 bg-white hover:border-[#34B386]",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {t("home.carousel.position")
          .replace("{current}", String(current + 1))
          .replace("{total}", String(promotions.length))}
      </p>
    </section>
  );
}

function safeDestination(value: string | null) {
  if (!value || value.startsWith("//")) return null;
  if (value.startsWith("/")) return { href: value, external: false } as const;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname
      ? ({ href: url.toString(), external: true } as const)
      : null;
  } catch {
    return null;
  }
}
