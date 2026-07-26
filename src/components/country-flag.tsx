import { normalizeCountry } from "@/lib/country-normalization";
import { cx } from "@/lib/utils";

export function CountryFlag({
  country,
  size = "sm",
  className,
}: {
  country: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { code, label } = normalizeCountry(country);
  if (!code) return null;

  return (
    <span
      className={cx(
        `fi fis fi-${code.toLowerCase()}`,
        "inline-block shrink-0 rounded-full border border-zinc-300 bg-cover bg-center shadow-[0_0_0_1px_rgba(255,255,255,0.45)_inset]",
        size === "md" ? "size-7" : "size-[18px]",
        className,
      )}
      role="img"
      aria-label={`${label} flag`}
    />
  );
}
