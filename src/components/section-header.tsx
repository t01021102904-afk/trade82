import type { ReactNode } from "react";

export function SectionHeader({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        {label ? (
          <p className="mb-2 text-sm font-medium text-blue-700">{label}</p>
        ) : null}
        <h2 className="break-words text-xl font-semibold theme-foreground sm:text-2xl">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 theme-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
