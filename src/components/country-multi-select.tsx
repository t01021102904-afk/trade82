"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { SelectOption } from "@/lib/company-select-options";
import { cx } from "@/lib/utils";

type CountryMultiSelectVariant = "light" | "theme";

type CountryMultiSelectProps = {
  label: string;
  helperText?: string;
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
  placeholder: string;
  noResultsText: string;
  allSelectedText: string;
  removeLabel: (country: string) => string;
  className?: string;
  maxSelections?: number;
  variant?: CountryMultiSelectVariant;
};

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function CountryMultiSelect({
  label,
  helperText,
  values,
  options,
  onChange,
  placeholder,
  noResultsText,
  allSelectedText,
  removeLabel,
  className,
  maxSelections = 50,
  variant = "light",
}: CountryMultiSelectProps) {
  const [query, setQuery] = useState("");
  const selectedValues = useMemo(() => uniqueValues(values), [values]);
  const selectedSet = useMemo(
    () => new Set(selectedValues.map((value) => value.toLowerCase())),
    [selectedValues],
  );
  const labelByValue = useMemo(
    () =>
      new Map(options.map((option) => [option.value, option.label] as const)),
    [options],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options
      .filter((option) => !selectedSet.has(option.value.toLowerCase()))
      .filter((option) => {
        if (!normalizedQuery) return true;
        return (
          option.label.toLowerCase().includes(normalizedQuery) ||
          option.value.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [options, query, selectedSet]);

  function addCountry(value: string) {
    if (selectedSet.has(value.toLowerCase()) || selectedValues.length >= maxSelections) {
      return;
    }
    onChange([...selectedValues, value]);
    setQuery("");
  }

  function removeCountry(value: string) {
    onChange(selectedValues.filter((country) => country !== value));
  }

  const isTheme = variant === "theme";
  const textClass = isTheme ? "theme-foreground" : "text-zinc-700";
  const helperClass = isTheme ? "theme-muted" : "text-zinc-500";
  const panelClass = isTheme
    ? "theme-surface theme-border"
    : "border-zinc-200 bg-white";
  const inputClass = isTheme
    ? "theme-input"
    : "border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400";
  const chipClass = isTheme
    ? "theme-surface-elevated theme-border theme-foreground"
    : "border-zinc-200 bg-zinc-50 text-zinc-700";
  const optionClass = isTheme
    ? "theme-foreground hover:bg-emerald-500/10"
    : "text-zinc-700 hover:bg-zinc-50";

  return (
    <fieldset className={cx("grid gap-2 text-sm", className)}>
      <legend className={cx("font-medium", textClass)}>{label}</legend>
      {helperText ? (
        <p className={cx("text-xs leading-5", helperClass)}>{helperText}</p>
      ) : null}
      <div className={cx("grid gap-3 rounded-xl border p-3", panelClass)}>
        {selectedValues.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((value) => (
              <span
                key={value}
                className={cx(
                  "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                  chipClass,
                )}
              >
                {labelByValue.get(value) ?? value}
                <button
                  type="button"
                  onClick={() => removeCountry(value)}
                  className="rounded-full p-0.5 transition hover:bg-red-500/10 hover:text-red-700"
                  aria-label={removeLabel(labelByValue.get(value) ?? value)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className={cx(
            "h-10 rounded-lg border px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20",
            inputClass,
          )}
        />
        <div className="grid max-h-56 gap-1 overflow-y-auto">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => addCountry(option.value)}
              disabled={selectedValues.length >= maxSelections}
              className={cx(
                "flex min-h-8 items-center rounded-md px-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                optionClass,
              )}
            >
              {option.label}
            </button>
          ))}
          {filteredOptions.length === 0 ? (
            <p className={cx("px-2 py-1 text-xs", helperClass)}>
              {query.trim() ? noResultsText : allSelectedText}
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}
