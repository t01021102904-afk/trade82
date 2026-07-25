import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("root metadata includes the exact Naver site verification token", () => {
  const layoutSource = readFileSync(
    path.join(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  assert.match(
    layoutSource,
    /verification:\s*\{\s*other:\s*\{\s*"naver-site-verification":\s*"f6d0a0dcd74cd888a45a7ecd402c50e097615748"/,
  );
});
