import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

type JsonValue = string | JsonValue[] | { [key: string]: JsonValue };

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function flatten(value: JsonValue, prefix = "", result = new Map<string, string>()) {
  if (typeof value === "string") {
    result.set(prefix, value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}.${index}`, result));
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

test("every static translation call resolves in English and Korean", async () => {
  const [english, korean, files] = await Promise.all([
    readFile(new URL("../messages/en.json", import.meta.url), "utf8").then(JSON.parse) as Promise<JsonValue>,
    readFile(new URL("../messages/ko.json", import.meta.url), "utf8").then(JSON.parse) as Promise<JsonValue>,
    sourceFiles(new URL("../src", import.meta.url).pathname),
  ]);
  const englishKeys = flatten(english);
  const koreanKeys = flatten(korean);
  const missing = new Set<string>();
  const staticCall = /\bt\(\s*(["'])([^"'\n]+)\1\s*\)/g;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(staticCall)) {
      const key = match[2];
      if (!englishKeys.has(key) || !koreanKeys.has(key)) missing.add(key);
    }
  }

  assert.deepEqual([...missing], []);
});

test("buyer legal agreement uses stable semantic keys and localized routes", async () => {
  const source = await readFile(
    new URL("../src/components/onboarding-form.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /footer\.legalLinks\.2\.label/);
  assert.match(source, /onboarding\.termsOfService/);
  assert.match(source, /onboarding\.privacyPolicy/);
  assert.match(source, /withLocale\("\/terms", locale\)/);
  assert.match(source, /withLocale\("\/privacy", locale\)/);
});

test("buttons keep labels on one line through the shared stylesheet", async () => {
  const source = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(source, /button\s*\{[\s\S]*white-space:\s*nowrap/);
});
