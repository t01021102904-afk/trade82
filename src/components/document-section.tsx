import type { DocumentBlock, DocumentSection as DocumentSectionData } from "@/lib/document-content";

export function DocumentSection({ section }: { section: DocumentSectionData }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-24 border-t border-zinc-200 pt-9 first:border-t-0 first:pt-0 sm:scroll-mt-28"
    >
      <h2
        id={`${section.id}-title`}
        className="break-words text-xl font-semibold leading-8 text-zinc-950 [overflow-wrap:anywhere] sm:text-2xl"
      >
        {section.title}
      </h2>
      <div className="mt-4 grid gap-5 text-[0.975rem] leading-8 text-zinc-700 sm:text-base">
        {section.blocks.map((block, index) => (
          <DocumentBlockContent key={`${section.id}-${index}`} block={block} />
        ))}
      </div>
    </section>
  );
}

export function DocumentBlocks({ blocks }: { blocks: DocumentBlock[] }) {
  return (
    <div className="grid gap-5 text-[0.975rem] leading-8 text-zinc-700 sm:text-base">
      {blocks.map((block, index) => (
        <DocumentBlockContent key={index} block={block} />
      ))}
    </div>
  );
}

function DocumentBlockContent({ block }: { block: DocumentBlock }) {
  if (block.type === "paragraph") {
    return <p className="break-words [overflow-wrap:anywhere]">{block.text}</p>;
  }

  const className = "grid gap-2 break-words pl-5 [overflow-wrap:anywhere]";
  if (block.style === "decimal") {
    return <ol className={`${className} list-decimal`}>{renderItems(block.items)}</ol>;
  }
  if (block.style === "alpha") {
    return <ol className={`${className} list-[lower-alpha]`}>{renderItems(block.items)}</ol>;
  }
  if (block.style === "korean") {
    return <ol className={`${className} list-[korean-hangul-formal]`}>{renderItems(block.items)}</ol>;
  }
  return <ul className={`${className} list-disc`}>{renderItems(block.items)}</ul>;
}

function renderItems(items: string[]) {
  return items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>);
}
