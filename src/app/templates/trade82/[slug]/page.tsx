import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplatePrintButton } from "@/components/template-print-button";
import {
  getTrade82TemplatePage,
  TRADE82_TEMPLATE_DISCLAIMER,
  trade82TemplatePages,
  type TemplateSection,
  type TemplateTable,
} from "@/lib/trade82-template-pages";

type TemplateRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return trade82TemplatePages.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: TemplateRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getTrade82TemplatePage(slug);

  if (!template) {
    return {
      title: "Trade82 Template",
    };
  }

  return {
    title: `${template.title} | Trade82 Template`,
    description: template.description,
  };
}

export default async function Trade82TemplateRoute({ params }: TemplateRouteProps) {
  const { slug } = await params;
  const template = getTrade82TemplatePage(slug);

  if (!template) notFound();

  return (
    <main className="trade82-template-screen min-h-screen bg-white px-4 py-6 text-[#111827] sm:px-6 lg:px-8">
      <style>{`
        html:has(.trade82-template-screen),
        body:has(.trade82-template-screen) {
          background: #ffffff !important;
          color: #111827 !important;
          color-scheme: light !important;
        }

        .trade82-template-screen,
        .trade82-template-screen * {
          color-scheme: light !important;
        }

        .trade82-template-screen {
          background: #ffffff !important;
          color: #111827 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .trade82-template-page {
          background: #ffffff !important;
          color: #111827 !important;
        }

        @media print {
          html,
          body,
          body:has(.trade82-template-screen) {
            background: #ffffff !important;
            color: #111827 !important;
            color-scheme: light !important;
          }

          body > header,
          body > footer {
            display: none !important;
          }

          .trade82-template-screen,
          .trade82-template-page,
          .trade82-template-section,
          .trade82-template-section label,
          .trade82-template-section span,
          .trade82-template-section p,
          .trade82-template-section h2,
          .trade82-template-page table,
          .trade82-template-page th,
          .trade82-template-page td {
            background: #ffffff !important;
            color: #111827 !important;
          }

          .trade82-template-screen {
            padding: 0 !important;
          }

          .trade82-template-actions {
            display: none !important;
          }

          .trade82-template-page {
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
            min-height: auto !important;
          }

          .trade82-template-section {
            break-inside: avoid;
          }

          .trade82-template-field,
          .trade82-template-notes,
          .trade82-template-table,
          .trade82-template-box {
            background: #ffffff !important;
            border-color: #d1d5db !important;
          }

          .trade82-template-table thead,
          .trade82-template-table th {
            background: #eef3ef !important;
            color: #111827 !important;
          }

          @page {
            margin: 0.55in;
            size: letter;
          }
        }
      `}</style>

      <div className="trade82-template-actions mx-auto mb-4 flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">
            Printable Trade82 template
          </p>
          <p className="mt-1 text-sm text-[#4b5563]">
            Use your browser print dialog to save this page as PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/seller"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-semibold text-[#111827] transition hover:border-[#64af8b]"
          >
            Back to Seller Dashboard
          </Link>
          <TemplatePrintButton />
        </div>
      </div>

      <article className="trade82-template-page mx-auto min-h-[10.5in] w-full max-w-5xl rounded-sm border border-[#d6d9d2] bg-white p-8 shadow-sm sm:p-10">
        <div className="h-1 w-full rounded-full bg-[#64af8b]" />

        <div className="mt-6 flex flex-col gap-6 border-b border-[#d1d5db] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">
              {template.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#111827]">
              {template.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
              {template.description}
            </p>
          </div>
          <div className="trade82-template-box rounded-xl border border-[#d1d5db] bg-white p-4 text-right">
            <p className="text-2xl font-semibold tracking-tight text-[#111827]">
              Trade82
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
              Workflow document
            </p>
          </div>
        </div>

        <section className="trade82-template-section mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {template.documentFields.map((field) => (
            <FieldBox key={field} label={field} />
          ))}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {template.parties.map((section) => (
            <FieldSection key={section.title} section={section} />
          ))}
        </section>

        {template.sections.length ? (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {template.sections.map((section) => (
              <FieldSection key={section.title} section={section} />
            ))}
          </section>
        ) : null}

        {template.tables.map((table) => (
          <TemplateTableBlock key={table.title} table={table} />
        ))}

        {template.declaration ? (
          <section className="trade82-template-section trade82-template-box mt-6 rounded-xl border border-[#d1d5db] bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#111827]">
              Declaration
            </h2>
            <p className="mt-3 min-h-20 text-sm leading-6 text-[#4b5563]">
              {template.declaration}
            </p>
          </section>
        ) : null}

        {template.notesLabel ? (
          <section className="trade82-template-section trade82-template-box mt-6 rounded-xl border border-[#d1d5db] bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#111827]">
              {template.notesLabel}
            </h2>
            <div className="trade82-template-notes mt-3 h-24 rounded-lg border border-dashed border-[#cbd5e1] bg-white" />
          </section>
        ) : null}

        {template.signatureLabels.length ? (
          <section className="trade82-template-section mt-8 grid gap-6 sm:grid-cols-2">
            {template.signatureLabels.map((label) => (
              <div key={label} className="pt-10">
                <div className="border-t border-[#111827]" />
                <p className="mt-2 text-sm font-semibold text-[#111827]">{label}</p>
                <p className="mt-1 text-xs text-[#6b7280]">Name / title / date</p>
              </div>
            ))}
          </section>
        ) : null}

        <footer className="trade82-template-section mt-8 border-t border-[#d1d5db] pt-4">
          <p className="text-[11px] leading-5 text-[#4b5563]">
            {TRADE82_TEMPLATE_DISCLAIMER}
          </p>
        </footer>
      </article>
    </main>
  );
}

function FieldSection({ section }: { section: TemplateSection }) {
  return (
    <section className="trade82-template-section trade82-template-box rounded-xl border border-[#d1d5db] bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#111827]">
        {section.title}
      </h2>
      <div className="mt-3 grid gap-3">
        {section.fields.map((field) => (
          <FieldBox key={field} label={field} />
        ))}
      </div>
    </section>
  );
}

function FieldBox({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
        {label}
      </span>
      <span className="trade82-template-field mt-1 block h-9 rounded-lg border border-[#d1d5db] bg-white" />
    </label>
  );
}

function TemplateTableBlock({ table }: { table: TemplateTable }) {
  return (
    <section className="trade82-template-section mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#111827]">
        {table.title}
      </h2>
      <div className="trade82-template-table mt-3 overflow-hidden rounded-xl border border-[#d1d5db] bg-white">
        <table className="w-full border-collapse text-left text-xs text-[#111827]">
          <thead className="bg-[#eef3ef]">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column}
                  className="border-r border-[#d1d5db] px-3 py-2 font-semibold last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: table.rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="h-10 border-t border-[#d1d5db]">
                {table.columns.map((column) => (
                  <td key={column} className="border-r border-[#e5e7eb] px-3 py-2 last:border-r-0">
                    &nbsp;
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
