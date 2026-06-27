import Link from "next/link";

import {
  CONTACT_EMAIL,
  getLegalDocument,
  legalDocuments,
  legalPathByDocument,
  type LegalDocumentKey,
} from "@/lib/legal-content";
import { withLocale, type Locale } from "@/lib/i18n";

const documentOrder: LegalDocumentKey[] = [
  "terms",
  "sourcingTerms",
  "privacy",
  "business",
];

export function LegalDocumentPage({
  locale,
  documentKey,
}: {
  locale: Locale;
  documentKey: LegalDocumentKey;
}) {
  const document = getLegalDocument(locale, documentKey);
  const alternateLocale = locale === "ko" ? "en" : "ko";
  const alternateDocument = getLegalDocument(alternateLocale, documentKey);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <nav
          aria-label={locale === "ko" ? "약관 문서" : "Legal documents"}
          className="flex flex-wrap gap-2 text-sm"
        >
          {documentOrder.map((key) => {
            const href = withLocale(legalPathByDocument[key], locale);
            const item = getLegalDocument(locale, key);
            const isActive = key === documentKey;

            return (
              <Link
                key={key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-md border px-3 font-medium transition ${
                  isActive
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <article className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-100 sm:p-8">
          <div className="border-b border-zinc-200 pb-6">
            <p className="text-sm font-semibold text-blue-700">Trade82</p>
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
              {document.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span>
                {locale === "ko" ? "최종 업데이트" : "Last updated"}:{" "}
                {document.updatedAt}
              </span>
              <span aria-hidden="true">·</span>
              <Link
                href={withLocale(legalPathByDocument[documentKey], alternateLocale)}
                className="font-medium text-blue-700 hover:text-blue-800"
              >
                {alternateDocument.title}
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-8">
            {document.sections.map((section) => (
              <section key={section.title} className="grid gap-3">
                <h2 className="break-words text-xl font-semibold text-zinc-950">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="break-words text-sm leading-7 text-zinc-700">
                    <TextWithContactLink text={paragraph} />
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul className="grid gap-2 pl-5 text-sm leading-7 text-zinc-700">
                    {section.bullets.map((item) => (
                      <li key={item} className="list-disc break-words">
                        <TextWithContactLink text={item} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function TextWithContactLink({ text }: { text: string }) {
  const parts = text.split(CONTACT_EMAIL);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? (
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-blue-700 underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function getLegalMetadata(locale: Locale, documentKey: LegalDocumentKey) {
  const document = legalDocuments[locale][documentKey];
  return {
    title: `${document.title} | Trade82`,
    description: document.description,
  };
}
