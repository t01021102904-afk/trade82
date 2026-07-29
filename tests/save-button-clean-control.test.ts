import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const saveButtonPath = path.join(
  root,
  "src/components/save-button.tsx",
);
const source = readFileSync(saveButtonPath, "utf8");

function parse(file: string, text: string) {
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  return sourceFile;
}

function collectTsx(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      return collectTsx(absolute);
    }

    return entry.endsWith(".tsx") ? [absolute] : [];
  });
}

test("bookmark save button has no visible button chrome", () => {
  assert.match(source, /AnimatedBookmarkIcon/);
  assert.doesNotMatch(source, /className=\{cn\(/);
  assert.match(source, /data-save-icon-only="true"/);
  assert.match(source, /!border-0/);
  assert.match(source, /!bg-transparent/);
  assert.match(source, /!shadow-none/);
  assert.match(source, /!ring-0/);
  assert.match(source, /background: "transparent"/);
  assert.match(source, /border: 0/);
  assert.match(source, /boxShadow: "none"/);
  assert.match(source, /padding: 0/);
});

test("bookmark save button never renders tooltip or loading feedback", () => {
  assert.doesNotMatch(source, /\btitle=/);
  assert.doesNotMatch(source, /\baria-busy=/);
  assert.doesNotMatch(source, /CometSpinner/);
  assert.doesNotMatch(source, /\banimate-spin\b/);
  assert.doesNotMatch(
    source,
    /<Tooltip|TooltipContent|TooltipTrigger/,
  );
  assert.doesNotMatch(source, /<(?:Loader|Loader2|LoaderCircle)\b/);
});

test("bookmark button contains only the animated bookmark", () => {
  const sourceFile = parse(saveButtonPath, source);
  let checked = 0;

  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile) ===
        "button" &&
      node.getText(sourceFile).includes(
        "AnimatedBookmarkIcon",
      )
    ) {
      checked += 1;
      const children = node.children
        .map((child) => child.getText(sourceFile))
        .join("")
        .trim();

      assert.match(
        children,
        /^<AnimatedBookmarkIcon[\s\S]*\/>$/,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.ok(checked > 0);
});

test("iconOnly SaveButton call sites do not re-add square chrome", () => {
  const files = [
    ...collectTsx(path.join(root, "src/components")),
    ...collectTsx(path.join(root, "src/app")),
  ];

  for (const file of files) {
    const text = readFileSync(file, "utf8");

    if (!text.includes("<SaveButton")) continue;

    const sourceFile = parse(file, text);

    function visit(node: ts.Node) {
      const isSaveButton =
        (ts.isJsxSelfClosingElement(node) ||
          ts.isJsxOpeningElement(node)) &&
        node.tagName.getText(sourceFile) === "SaveButton";

      if (isSaveButton) {
        const attributes = node.attributes.properties;
        const iconOnly = attributes.some(
          (property) =>
            ts.isJsxAttribute(property) &&
            property.name.getText(sourceFile) === "iconOnly",
        );

        if (iconOnly) {
          const className = attributes.find(
            (property) =>
              ts.isJsxAttribute(property) &&
              property.name.getText(sourceFile) === "className",
          );

          if (
            className &&
            ts.isJsxAttribute(className) &&
            className.initializer &&
            ts.isStringLiteral(className.initializer)
          ) {
            assert.doesNotMatch(
              className.initializer.text,
              /\b(?:border(?:-\S+)?|bg-\S+|shadow(?:-\S+)?|ring(?:-\S+)?|rounded(?:-\S+)?)\b/,
              file,
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
});

test("save behavior and animation remain", () => {
  assert.match(source, /\/api\/saved-items/);
  assert.match(source, /setPending\(true\)/);
  assert.match(source, /setPending\(false\)/);
  assert.match(source, /\bdisabled=/);
  assert.match(
    source,
    /AnimatedBookmarkIcon saved=\{Boolean\(saved\)\}/,
  );
  assert.match(source, /scale: \[1, 1\.24, 0\.96, 1\]/);
  assert.match(source, /whileTap=\{\{ scale: 0\.82 \}\}/);
});
