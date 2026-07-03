"use client";

import Image from "next/image";
import { type CSSProperties, type PointerEvent, useState } from "react";

import type { Locale } from "@/lib/i18n";

type VisualStyle = CSSProperties & {
  "--mouse-x": string;
  "--mouse-y": string;
};

const imageCopy = {
  en: {
    mainAlt: "Isometric export documents and contract templates illustration",
    logisticsAlt: "Isometric logistics shipping workflow illustration",
    chatAlt: "Isometric beauty product buyer chat illustration",
    documents: "Export documents",
    logistics: "Logistics workflow",
    chat: "Buyer inquiry",
  },
  ko: {
    mainAlt: "수출 서류와 계약 템플릿 아이소메트릭 일러스트",
    logisticsAlt: "수출 물류 업무 아이소메트릭 일러스트",
    chatAlt: "뷰티 상품 바이어 문의 아이소메트릭 일러스트",
    documents: "수출 서류",
    logistics: "물류 흐름",
    chat: "바이어 문의",
  },
} satisfies Record<Locale, Record<string, string>>;

export function HomeWorkflowVisual({ locale }: { locale: Locale }) {
  const [cursor, setCursor] = useState({ x: 50, y: 44 });
  const copy = imageCopy[locale];

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
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border theme-border theme-surface-muted sm:min-h-[500px]">
          <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
          <div className="absolute left-1/2 top-4 z-20 w-[78%] max-w-[520px] -translate-x-1/2">
            <Image
              src="/landing/export-documents.png"
              alt={copy.mainAlt}
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 1024px) 520px, 90vw"
              className="home-hero-asset home-hero-asset-main h-auto w-full object-contain"
            />
          </div>
          <div className="absolute -left-2 bottom-8 z-10 w-[47%] max-w-[300px]">
            <Image
              src="/landing/beauty-products-chat.png"
              alt={copy.chatAlt}
              width={1448}
              height={1086}
              sizes="(min-width: 1024px) 300px, 46vw"
              className="home-hero-asset home-hero-asset-left h-auto w-full object-contain"
            />
          </div>
          <div className="absolute -right-3 bottom-7 z-10 w-[50%] max-w-[330px]">
            <Image
              src="/landing/logistics-shipping.png"
              alt={copy.logisticsAlt}
              width={1448}
              height={1086}
              sizes="(min-width: 1024px) 330px, 48vw"
              className="home-hero-asset home-hero-asset-right h-auto w-full object-contain"
            />
          </div>
          <div className="absolute inset-x-4 bottom-4 z-30 grid gap-2 sm:grid-cols-3">
            {[copy.documents, copy.chat, copy.logistics].map((label) => (
              <span
                key={label}
                className="rounded-full border px-3 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur theme-success-badge"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
