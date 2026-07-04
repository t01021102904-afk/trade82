import Image from "next/image";

import { cx } from "@/lib/utils";

export function VerifiedSellerBadge({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      className={cx(
        "inline-flex shrink-0 items-center align-middle",
        compact ? "size-4" : "size-5",
        className,
      )}
      title="Verified Seller subscription active"
      aria-label="Verified Seller subscription active"
    >
      <Image
        src="/Trade82/trade82_verified_sticker.png"
        alt=""
        width={compact ? 16 : 20}
        height={compact ? 16 : 20}
        className="size-full object-contain"
        loading="lazy"
        aria-hidden="true"
      />
    </span>
  );
}
