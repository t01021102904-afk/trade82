import type { ReactNode } from "react";

export function DetailTable({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th className="w-1/3 bg-zinc-50 px-4 py-3 text-left font-medium text-zinc-600">
                {row.label}
              </th>
              <td className="px-4 py-3 text-zinc-900">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
