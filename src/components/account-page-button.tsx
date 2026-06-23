"use client";

import { useClerk } from "@clerk/nextjs";

import { cx } from "@/lib/utils";

export function AccountPageButton({
  page,
  children,
  className,
}: {
  page: "professional" | "company" | "products";
  children: React.ReactNode;
  className?: string;
}) {
  const { openUserProfile } = useClerk();
  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      data-account-page={page}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700",
        className,
      )}
    >
      {children}
    </button>
  );
}
