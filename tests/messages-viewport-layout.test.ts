import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("embedded seller messages stay bounded to the viewport", () => {
  const shell = readFileSync(
    path.join(root, "src/components/seller-dashboard-shell.tsx"),
    "utf8",
  );
  const messages = readFileSync(
    path.join(root, "src/components/messages-client.tsx"),
    "utf8",
  );

  assert.ok(
    shell.includes(
      "h-[calc(100dvh_-_var(--header-height)_-_2rem)]",
    ),
  );
  assert.ok(
    shell.includes(
      "md:h-[calc(100dvh_-_var(--header-height)_-_3rem)]",
    ),
  );
  assert.ok(shell.includes("flex-col overflow-hidden px-4"));

  assert.ok(messages.includes("messagesViewportRef"));
  assert.ok(messages.includes("desktopViewport.scrollTop = desktopViewport.scrollHeight"));
  assert.ok(messages.includes("hidden h-full min-h-0 w-full flex-1 overflow-hidden"));
  assert.ok(messages.includes("overflow-y-auto overscroll-contain"));
  assert.ok(messages.includes('ref={messagesViewportRef}'));
});
