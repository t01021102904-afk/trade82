"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CountryFlag } from "@/components/country-flag";
import { localizedCountryLabel } from "@/lib/country-normalization";
import type { Locale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

export function CountryFilterSelect({
  label,
  allLabel,
  value,
  countries,
  locale,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  countries: string[];
  locale: Locale;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const listboxId = `${controlId}-options`;
  const options = ["all", ...countries];
  const selectedLabel =
    value === "all" ? allLabel : localizedCountryLabel(value, locale);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const select = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative grid min-w-0 gap-1.5 text-sm">
      <span id={labelId} className="font-semibold text-zinc-950">
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => {
          setActiveIndex(Math.max(0, options.indexOf(value)));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setActiveIndex((current) => {
              const offset = event.key === "ArrowDown" ? 1 : -1;
              return (current + offset + options.length) % options.length;
            });
          }
          if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            select(options[activeIndex]);
          }
        }}
        className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-left text-zinc-800 outline-none focus:border-[#34B386] focus:ring-2 focus:ring-[#34B386]/20"
      >
        {value !== "all" ? <CountryFlag country={value} /> : null}
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute top-full z-30 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-xl"
        >
          {options.map((option, index) => {
            const selected = option === value;
            const optionLabel =
              option === "all"
                ? allLabel
                : localizedCountryLabel(option, locale);
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => select(option)}
                className={cx(
                  "flex min-h-10 w-full items-center gap-2 rounded px-2.5 text-left text-sm",
                  activeIndex === index ? "bg-zinc-100" : "hover:bg-zinc-50",
                )}
              >
                {option !== "all" ? <CountryFlag country={option} /> : null}
                <span className="min-w-0 flex-1 truncate">{optionLabel}</span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-[#34B386]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
