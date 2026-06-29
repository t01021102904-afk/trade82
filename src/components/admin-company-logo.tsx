"use client";

import { useState } from "react";

import { cx } from "@/lib/utils";

export function AdminCompanyLogo({
  companyName,
  logoUrl,
  className,
}: {
  companyName: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = companyName.trim().charAt(0).toUpperCase() || "T";
  const showImage = Boolean(logoUrl && !failed);

  return (
    <div
      className={cx(
        "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50",
        className,
      )}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl ?? ""}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xl font-semibold text-zinc-500">{initial}</span>
      )}
    </div>
  );
}
