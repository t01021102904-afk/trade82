import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return collectSourceFiles(absolute);
    return /\.(tsx?|jsx?)$/.test(entry) ? [absolute] : [];
  });
}

test("all rotating loading indicators use the shared comet spinner", () => {
  const sourceFiles = collectSourceFiles(path.join(root, "src"));
  const combined = sourceFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(combined, /\banimate-spin\b/);

  const component = readFileSync(
    path.join(root, "src/components/ui/comet-spinner.tsx"),
    "utf8",
  );
  assert.match(component, /from "framer-motion"/);
  assert.match(component, /conic-gradient/);
  assert.match(component, /animate=\{\{ rotate: 360 \}\}/);

  for (const loadingPath of [
    "src/app/loading.tsx",
    "src/app/marketplace/loading.tsx",
  ]) {
    assert.match(
      readFileSync(path.join(root, loadingPath), "utf8"),
      /CometLoadingScreen/,
    );
  }
});
