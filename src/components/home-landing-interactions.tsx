"use client";

import { Minus, Play, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AutoVideoProps = {
  src: string;
  title: string;
  eyebrow: string;
  fallbackTitle: string;
  fallbackText: string;
};

export function HomeAutoVideo({
  src,
  title,
  eyebrow,
  fallbackTitle,
  fallbackText,
}: AutoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.36 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border p-3 theme-surface-elevated">
      <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true" />
      <div className="relative aspect-[16/10] overflow-hidden rounded-[1.1rem] border theme-border theme-surface-muted">
        {hasError ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border theme-success-badge">
              <Play className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-semibold theme-foreground">{fallbackTitle}</p>
            <p className="mt-2 max-w-sm text-xs leading-5 theme-muted">{fallbackText}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            aria-label={title}
            className="h-full w-full object-cover"
            src={src}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setHasError(true)}
          />
        )}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur theme-success-badge">
          {eyebrow}
        </div>
      </div>
    </div>
  );
}

type FaqItem = {
  question: string;
  answer: string;
};

export function HomeFaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="divide-y theme-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="py-1">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-5 rounded-xl px-1 py-5 text-left transition hover:bg-white/[0.03]"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
            >
              <span className="text-sm font-semibold theme-foreground sm:text-[15px]">
                {item.question}
              </span>
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border theme-border theme-surface-muted">
                {isOpen ? (
                  <Minus className="size-4" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
              </span>
            </button>
            {isOpen ? (
              <p className="max-w-4xl px-1 pb-5 text-sm leading-6 theme-muted">
                {item.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
