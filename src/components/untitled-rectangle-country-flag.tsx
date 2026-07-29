"use client";

import Image from "next/image";

import { countryCodes } from "@/lib/company-select-options";
import { untitledRectangleFlagCodes } from "@/lib/untitled-rectangle-flag-codes";

type CountryCodeEntry = string | Record<string, unknown>;

const regionNamesEn = new Intl.DisplayNames(["en"], { type: "region" });
const regionNamesKo = new Intl.DisplayNames(["ko"], { type: "region" });

const countryAliases: Record<string, string> = {
  america: "US",
  "united states of america": "US",
  usa: "US",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  korea: "KR",
  "republic of korea": "KR",
  "south korea": "KR",
  "대한민국": "KR",
  한국: "KR",
};

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function nestedStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(nestedStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      nestedStrings,
    );
  }
  return [];
}

function entryCode(entry: CountryCodeEntry) {
  if (typeof entry === "string") {
    return /^[a-z]{2}$/i.test(entry.trim())
      ? entry.trim().toUpperCase()
      : null;
  }

  for (const key of [
    "code",
    "value",
    "countryCode",
    "iso2",
    "alpha2",
  ]) {
    const candidate = entry[key];
    if (
      typeof candidate === "string" &&
      /^[a-z]{2}$/i.test(candidate.trim())
    ) {
      return candidate.trim().toUpperCase();
    }
  }

  return null;
}

const countryEntries = countryCodes as unknown as CountryCodeEntry[];
const availableFlagCodes = new Set<string>(untitledRectangleFlagCodes);

function resolveCountryCode(country: string) {
  const raw = country.trim();
  if (!raw) return null;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();

  const normalized = normalizeLookupValue(raw);
  const alias = countryAliases[normalized];
  if (alias) return alias;

  for (const entry of countryEntries) {
    const code = entryCode(entry);
    if (!code) continue;

    const aliases = new Set([
      code,
      regionNamesEn.of(code) ?? "",
      regionNamesKo.of(code) ?? "",
      ...nestedStrings(entry),
    ]);

    if (
      Array.from(aliases).some(
        (candidate) =>
          candidate &&
          normalizeLookupValue(candidate) === normalized,
      )
    ) {
      return code;
    }
  }

  return null;
}

/**
 * Original Rectangle SVG assets from:
 * https://www.untitledui.com/resources/flag-icons
 */
export function UntitledRectangleCountryFlag({
  country,
}: {
  country: string;
}) {
  const code = resolveCountryCode(country);

  if (!code || !availableFlagCodes.has(code)) {
    return (
      <span
        aria-hidden="true"
        data-slot="untitled-rectangle-country-flag"
        className="inline-flex h-3.5 w-[21px] shrink-0 items-center justify-center rounded-[2px] border border-zinc-200 bg-zinc-50 text-[8px] font-semibold text-zinc-500"
      >
        —
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-slot="untitled-rectangle-country-flag"
      className="inline-flex h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-inset ring-black/10"
    >
      <Image
        src={`/flags/rectangle/${code}.svg`}
        alt=""
        width={21}
        height={14}
        unoptimized
        className="h-3.5 w-[21px] object-cover"
      />
    </span>
  );
}
