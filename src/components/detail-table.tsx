import type { ReactNode } from "react";

export function DetailTable({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border theme-surface">
      <table className="w-full table-fixed text-sm">
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th className="w-1/3 break-words px-4 py-3 text-left font-medium theme-surface-muted theme-muted">
                {row.label}
              </th>
              <td className="min-w-0 break-words px-4 py-3 theme-foreground">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
