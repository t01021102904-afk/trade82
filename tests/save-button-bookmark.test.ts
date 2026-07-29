import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const file = path.join(
  process.cwd(),
  "src/components/save-button.tsx",
);
const source = readFileSync(file, "utf8");

function saveButtonSource() {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let button = "";

  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(sourceFile) === "button" &&
      node.getText(sourceFile).includes("AnimatedBookmarkIcon")
    ) {
      button = node.getText(sourceFile);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return button;
}

test("save button uses the supplied animated bookmark", () => {
  assert.match(source, /import \{ motion \} from "framer-motion"/);
  assert.match(source, /function AnimatedBookmarkIcon/);
  assert.match(source, /width=\{24\}/);
  assert.match(source, /height=\{24\}/);
  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(
    source,
    /M5 7\.8C5 6\.11984 5 5\.27976 5\.32698 4\.63803/,
  );
  assert.match(source, /fill=\{saved \? "currentColor" : "none"\}/);
  assert.match(source, /scale: \[1, 1\.24, 0\.96, 1\]/);
  assert.match(source, /whileTap=\{\{ scale: 0\.82 \}\}/);
});

test("save control is visually only the bookmark icon", () => {
  const button = saveButtonSource();

  assert.ok(button, "Save button must exist");
  assert.match(button, /AnimatedBookmarkIcon/);
  assert.match(button, /backgroundColor: "transparent"/);
  assert.match(button, /borderColor: "transparent"/);
  assert.match(button, /boxShadow: "none"/);
  assert.match(button, /opacity: 1/);
  assert.doesNotMatch(button, /\btitle=/);
  assert.doesNotMatch(button, /CometSpinner/);
  assert.doesNotMatch(button, />\s*(?:Saved|Removed)\s*</);
  assert.doesNotMatch(button, /pending\s*\?/);
});

test("save behavior and duplicate-click protection remain", () => {
  assert.match(source, /\/api\/saved-items/);
  assert.match(source, /setPending\(true\)/);
  assert.match(source, /setPending\(false\)/);
  assert.match(source, /\bdisabled=/);
  assert.match(source, /AnimatedBookmarkIcon saved=\{Boolean\(saved\)\}/);
});
