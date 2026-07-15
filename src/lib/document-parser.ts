import type { DocumentSlug } from "@/lib/document-registry";

export type DocumentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; style: "bullet" | "decimal" | "alpha" | "korean"; items: string[] };

export type DocumentSection = {
  id: string;
  title: string;
  blocks: DocumentBlock[];
};

export type ParsedDocument = {
  slug: DocumentSlug;
  title: string;
  description: string;
  effectiveDate?: string;
  lastUpdated?: string;
  intro: DocumentBlock[];
  sections: DocumentSection[];
};

export function parseDocumentSource(
  source: string,
  slug: DocumentSlug,
  description: string,
): ParsedDocument {
  const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  const title =
    firstContentIndex >= 0
      ? stripMarkdownHeading(lines[firstContentIndex].trim())
      : "Trade82";
  const contentLines = lines.slice(firstContentIndex + 1);
  const metadata = readLeadingMetadata(contentLines);
  const { introLines, sections } = splitIntoSections(metadata.remainingLines, slug);

  return {
    slug,
    title,
    description,
    effectiveDate: metadata.effectiveDate,
    lastUpdated: metadata.lastUpdated,
    intro: parseBlocks(introLines),
    sections: sections.map((section, index) => ({
      id: `section-${index + 1}`,
      title: section.title,
      blocks: parseBlocks(section.lines),
    })),
  };
}

function readLeadingMetadata(lines: string[]) {
  let effectiveDate: string | undefined;
  let lastUpdated: string | undefined;
  const remainingLines: string[] = [];

  for (const line of lines) {
    const normalized = line.trim().replaceAll("**", "");
    const effectiveMatch = normalized.match(/^(?:Effective Date|시행일):\s*(.+)$/i);
    const updatedMatch = normalized.match(/^(?:Last Updated|최종 업데이트):\s*(.+)$/i);

    if (effectiveMatch) {
      effectiveDate = effectiveMatch[1].trim();
      continue;
    }

    if (updatedMatch) {
      lastUpdated = updatedMatch[1].trim();
      continue;
    }

    remainingLines.push(line);
  }

  return { effectiveDate, lastUpdated, remainingLines };
}

function splitIntoSections(lines: string[], slug: DocumentSlug) {
  const introLines: string[] = [];
  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentSection: { title: string; lines: string[] } | undefined;
  const usesNumberedSections = DOCUMENTS_WITH_NUMBERED_SECTIONS.has(slug);
  let nextSectionNumber = 1;

  for (const [index, line] of lines.entries()) {
    const isHeading = usesNumberedSections
      ? isExpectedNumberedSectionStart(lines, index, nextSectionNumber)
      : isSectionHeading(line);

    if (isHeading) {
      currentSection = { title: stripMarkdownHeading(line.trim()), lines: [] };
      sections.push(currentSection);
      if (usesNumberedSections) nextSectionNumber += 1;
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      introLines.push(line);
    }
  }

  return { introLines, sections };
}

function isExpectedNumberedSectionStart(
  lines: string[],
  index: number,
  expectedNumber: number,
) {
  const line = lines[index];
  const markdownHeading = line.trim().match(/^##\s+(\d+)\.\s+.+$/);
  if (markdownHeading) {
    return (
      Number(markdownHeading[1]) === expectedNumber &&
      !/^\s*\d+\.\s+/.test(lines[index + 1] ?? "")
    );
  }

  if (!isNumberedSectionStart(lines, index)) return false;
  const match = line.match(/^(\d+)\.\s+.+$/);
  return (
    match !== null &&
    Number(match[1]) === expectedNumber &&
    !/^\s*\d+\.\s+/.test(lines[index + 1] ?? "")
  );
}

function isNumberedSectionStart(lines: string[], index: number) {
  const line = lines[index];
  if (!line || /^\s/.test(line)) return false;

  const trimmed = line.trim();
  if (/^##\s+\d+\.\s+.+$/.test(trimmed)) return true;
  return /^\d+\.\s+.+$/.test(trimmed);
}

const DOCUMENTS_WITH_NUMBERED_SECTIONS = new Set<DocumentSlug>([
  "for-sellers",
  "product-registration-guide",
  "rfq-guide",
  "export-shipping-guide",
  "compliance-documentation",
  "privacy",
  "terms",
  "payment-refund-policy",
]);

function isSectionHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;

  const markdownHeading = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (markdownHeading) {
    return markdownHeading[1].length === 2;
  }

  const numberedHeading = trimmed.match(/^(\d+(?:\.\d+)*\.)\s+(.+)$/);
  if (numberedHeading) {
    return !/[.;:]$/.test(numberedHeading[2]);
  }

  if (isListItem(trimmed)) return false;

  if (/[.!?;:]$/.test(trimmed)) return false;
  if (!/^[A-Z가-힣]/.test(trimmed)) return false;

  return trimmed.split(/\s+/).length <= 12;
}

function isListItem(line: string) {
  return /^(?:[•*◦-]|\d+[.)]|[A-Za-z가-힣][.)])\s+/.test(line);
}

function parseBlocks(lines: string[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listStyle: "bullet" | "decimal" | "alpha" | "korean" = "bullet";

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length) blocks.push({ type: "list", style: listStyle, items: listItems });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = stripMarkdownHeading(line.trim());
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const listMatch = trimmed.match(/^([•*◦-]|\d+[.)]|[A-Za-z가-힣][.)])\s+(.+)$/);
    if (listMatch) {
      const nextStyle = getListStyle(listMatch[1]);
      if (listItems.length && listStyle !== nextStyle) flushList();
      flushParagraph();
      listStyle = nextStyle;
      listItems.push(listMatch[2]);
      continue;
    }

    if (listItems.length) flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function stripMarkdownHeading(value: string) {
  return value.replace(/^#{1,6}\s+/, "");
}

function getListStyle(marker: string): "bullet" | "decimal" | "alpha" | "korean" {
  if (/^\d/.test(marker)) return "decimal";
  if (/^[가-힣]/.test(marker)) return "korean";
  if (/^[A-Za-z]/.test(marker)) return "alpha";
  return "bullet";
}
