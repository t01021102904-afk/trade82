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
      className="home-magnetic-panel bm-section-in w-full max-w-full rounded-[1.25rem] border p-2 theme-surface sm:rounded-[1.75rem] sm:p-3"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={style}
    >
      <div className="relative overflow-hidden rounded-[1rem] border p-2 theme-surface-elevated sm:rounded-[1.35rem] sm:p-5">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden="true" />
        <div className="relative min-h-[292px] overflow-hidden rounded-xl border pb-12 theme-border theme-surface-muted sm:min-h-[500px] sm:rounded-2xl sm:pb-0">
          <div className="absolute inset-x-6 top-4 h-20 rounded-full bg-emerald-300/10 blur-3xl sm:top-6 sm:h-24" aria-hidden="true" />
          <div className="absolute left-1/2 top-2 z-20 w-[82%] max-w-[520px] -translate-x-1/2 sm:top-4 sm:w-[78%]">
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
          <div className="absolute -left-2 bottom-12 z-10 w-[45%] max-w-[300px] sm:bottom-8 sm:w-[47%]">
            <Image
              src="/landing/beauty-products-chat.png"
              alt={copy.chatAlt}
              width={1448}
              height={1086}
              sizes="(min-width: 1024px) 300px, 46vw"
              className="home-hero-asset home-hero-asset-left h-auto w-full object-contain"
            />
          </div>
          <div className="absolute -right-3 bottom-12 z-10 w-[47%] max-w-[330px] sm:bottom-7 sm:w-[50%]">
            <Image
              src="/landing/logistics-shipping.png"
              alt={copy.logisticsAlt}
              width={1448}
              height={1086}
              sizes="(min-width: 1024px) 330px, 48vw"
              className="home-hero-asset home-hero-asset-right h-auto w-full object-contain"
            />
          </div>
          <div className="absolute inset-x-2 bottom-2 z-30 grid grid-cols-3 gap-1 sm:inset-x-4 sm:bottom-4 sm:gap-2">
            {[copy.documents, copy.chat, copy.logistics].map((label) => (
              <span
                key={label}
                className="rounded-full border px-1.5 py-1 text-center font-mono text-[8px] font-semibold uppercase leading-tight tracking-[0.06em] backdrop-blur theme-success-badge sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.12em]"
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
