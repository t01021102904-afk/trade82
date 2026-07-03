import { CheckCircle2 } from "lucide-react";

export function VerifiedSellerBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold theme-success-badge"
      title="Verified Seller subscription active"
      aria-label="Verified Seller subscription active"
    >
      <CheckCircle2 className={compact ? "size-3" : "size-3.5"} aria-hidden="true" />
      {compact ? "Verified" : "Verified Seller"}
    </span>
  );
}
