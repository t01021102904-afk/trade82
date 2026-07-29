import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      return collectSourceFiles(absolute);
    }
    return /\.(tsx?|jsx?)$/.test(entry) ? [absolute] : [];
  });
}

test("all loading indicators use the shared spinner", () => {
  const sourceFiles = collectSourceFiles(path.join(root, "src"));
  const combined = sourceFiles
    .filter((file) => !file.endsWith("comet-spinner.tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(combined, /\banimate-spin\b/);
  assert.doesNotMatch(combined, /<Loader(?:2|Circle)\b/);

  const component = readFileSync(
    path.join(root, "src/components/ui/comet-spinner.tsx"),
    "utf8",
  );

  assert.match(component, /from "framer-motion"/);
  assert.match(component, /export function IOSSpinner/);
  assert.match(component, /export function CometSpinner/);
  assert.match(component, /Array\.from\(\{ length: 12 \}\)/);
  assert.match(component, /style=\{\{ rotate: index \* 30 \}\}/);
  assert.match(component, /opacity: \[1, 0\.2\]/);
  assert.match(component, /delay: index \* \(1 \/ 12\)/);
  assert.match(component, /bg-foreground/);
  assert.doesNotMatch(component, /conic-gradient/);
  assert.doesNotMatch(component, /rotate: 360/);
  assert.doesNotMatch(
    component,
    /zinc-|slate-|green-|emerald-|#[0-9a-fA-F]{3,8}/,
  );

  for (const loadingPath of [
    "src/app/loading.tsx",
    "src/app/marketplace/loading.tsx",
  ]) {
    assert.match(
      readFileSync(path.join(root, loadingPath), "utf8"),
      /CometLoadingScreen/,
    );
  }

  for (const localizedLoadingPath of [
    "src/app/en/marketplace/loading.tsx",
    "src/app/ko/marketplace/loading.tsx",
  ]) {
    assert.match(
      readFileSync(path.join(root, localizedLoadingPath), "utf8"),
      /CometLoadingScreen|export \{ default \} from "\.\.\/\.\.\/marketplace\/loading"/,
    );
  }
});
