"use client";

import { type CSSProperties, type PointerEvent, useState } from "react";

type HomeVisualCopy = {
  sellerLabel: string;
  sellerTitle: string;
  sellerMeta: string[];
  platformLabel: string;
  platformTitle: string;
  platformItems: string[];
  buyerLabel: string;
  buyerTitle: string;
  inquiryTitle: string;
  inquiryText: string;
  statusDraft: string;
  statusPublished: string;
  statusLead: string;
};

type VisualStyle = CSSProperties & {
  "--mouse-x": string;
  "--mouse-y": string;
};

export function HomeWorkflowVisual({ copy }: { copy: HomeVisualCopy }) {
  const [cursor, setCursor] = useState({ x: 50, y: 44 });

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCursor({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  function handlePointerLeave() {
    setCursor({ x: 50, y: 44 });
  }

  const style: VisualStyle = {
    "--mouse-x": `${cursor.x}%`,
    "--mouse-y": `${cursor.y}%`,
  };

  return (
    <div
      className="home-magnetic-panel bm-section-in rounded-[1.75rem] border p-3 theme-surface"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={style}
    >
      <div className="relative overflow-hidden rounded-[1.35rem] border p-4 theme-surface-elevated sm:p-5">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden="true" />
        <div className="relative grid gap-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
            <VisualCard
              label={copy.sellerLabel}
              title={copy.sellerTitle}
              badge={copy.statusDraft}
              lines={copy.sellerMeta}
            />
            <Connector />
            <PlatformCard copy={copy} />
            <Connector />
            <VisualCard
              label={copy.buyerLabel}
              title={copy.buyerTitle}
              badge={copy.statusLead}
              lines={[copy.inquiryTitle, copy.statusPublished]}
            />
          </div>
          <div className="home-inquiry-card rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-success-text">
                {copy.inquiryTitle}
              </span>
              <span className="home-live-dot size-2 rounded-full bg-emerald-300" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm leading-6 theme-foreground">{copy.inquiryText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualCard({
  label,
  title,
  badge,
  lines,
}: {
  label: string;
  title: string;
  badge: string;
  lines: string[];
}) {
  return (
    <article className="home-flow-card rounded-2xl border p-4 theme-surface-muted">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted">
          {label}
        </p>
        <span className="shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-success-badge">
          {badge}
        </span>
      </div>
      <h3 className="mt-5 text-sm font-semibold leading-5 theme-foreground">{title}</h3>
      <div className="mt-4 grid gap-2">
        {lines.map((line) => (
          <span key={line} className="h-7 rounded-lg border px-2 py-1 text-[11px] theme-border theme-muted">
            {line}
          </span>
        ))}
      </div>
    </article>
  );
}

function PlatformCard({ copy }: { copy: HomeVisualCopy }) {
  return (
    <article className="home-flow-card rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-success-text">
        {copy.platformLabel}
      </p>
      <h3 className="mt-5 text-sm font-semibold leading-5 theme-foreground">
        {copy.platformTitle}
      </h3>
      <div className="mt-4 grid gap-2">
        {copy.platformItems.map((item) => (
          <span key={item} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] theme-foreground">
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

function Connector() {
  return (
    <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
      <span className="h-px w-10 bg-gradient-to-r from-emerald-300/35 to-sky-300/35" />
      <span className="home-moving-dot size-2 rounded-full bg-emerald-300" />
    </div>
  );
}
