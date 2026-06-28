"use client";

import Image from "next/image";
import { useState } from "react";

import { safeExternalUrl } from "@/lib/url-security";
import { cx } from "@/lib/utils";

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T82"
  );
}

function safeLogoCandidates(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => safeExternalUrl(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function PersonalAvatar({
  name,
  avatarUrl,
  useDefault,
  className,
}: {
  name: string;
  avatarUrl?: string;
  useDefault: boolean;
  className?: string;
}) {
  const safeAvatarUrl = safeExternalUrl(avatarUrl);
  if (!useDefault && safeAvatarUrl) {
    return (
      <Image
        src={safeAvatarUrl}
        alt=""
        width={64}
        height={64}
        unoptimized
        className={cx("size-10 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cx(
        "flex size-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function CompanyLogo({
  companyName,
  logoUrl,
  logoUrls,
  useDefaultLogo,
  size = "md",
  shape = "square",
  className,
}: {
  companyName: string;
  logoUrl?: string;
  logoUrls?: string[];
  useDefaultLogo: boolean;
  size?: "sm" | "md" | "lg";
  shape?: "square" | "circle";
  className?: string;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const dimensions = {
    sm: { pixels: 40, classes: "size-10 text-xs" },
    md: { pixels: 64, classes: "size-16 text-lg" },
    lg: { pixels: 80, classes: "size-20 text-xl" },
  }[size];
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-md";
  const logoCandidates = safeLogoCandidates([...(logoUrls ?? []), logoUrl]);
  const validLogoUrl = logoCandidates.find((url) => !failedUrls.includes(url));
  const showImage = !useDefaultLogo && Boolean(validLogoUrl);

  if (showImage && validLogoUrl) {
    return (
      <Image
        src={validLogoUrl}
        alt={`${companyName} logo`}
        width={dimensions.pixels}
        height={dimensions.pixels}
        unoptimized
        onError={() =>
          setFailedUrls((current) =>
            current.includes(validLogoUrl)
              ? current
              : [...current, validLogoUrl],
          )
        }
        className={cx(
          "shrink-0 border border-zinc-200 bg-white object-contain",
          dimensions.classes,
          shapeClass,
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 font-semibold text-zinc-700",
        dimensions.classes,
        shapeClass,
        className,
      )}
      aria-label={`${companyName} default logo`}
    >
      {initials(companyName)}
    </span>
  );
}
