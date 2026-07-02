"use client";

export function TemplatePrintButton() {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center rounded-lg bg-[#111827] px-3 text-sm font-semibold text-white transition hover:bg-[#0f172a]"
      onClick={() => window.print()}
    >
      Print / Save as PDF
    </button>
  );
}
