import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src/components/save-button.tsx"),
  "utf8",
);

test("save button uses the supplied bookmark SVG instead of the old favorite icon", () => {
  assert.match(source, /import \{ motion \} from "framer-motion"/);
  assert.match(source, /function AnimatedBookmarkIcon/);
  assert.match(source, /width=\{24\}/);
  assert.match(source, /height=\{24\}/);
  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(
    source,
    /M5 7\.8C5 6\.11984 5 5\.27976 5\.32698 4\.63803/,
  );
  assert.match(source, /strokeWidth=\{2\}/);
  assert.match(source, /strokeLinecap="round"/);
  assert.match(source, /strokeLinejoin="round"/);
  assert.doesNotMatch(
    source,
    /<(?:Heart|HeartIcon|Bookmark|BookmarkIcon)\b/,
  );
});

test("bookmark reflects saved state and animates on save and press", () => {
  assert.match(source, /fill=\{saved \? "currentColor" : "none"\}/);
  assert.match(source, /initial=\{false\}/);
  assert.match(source, /scale: \[1, 1\.24, 0\.96, 1\]/);
  assert.match(source, /y: \[0, -2, 0, 0\]/);
  assert.match(source, /rotate: \[0, -5, 3, 0\]/);
  assert.match(source, /whileTap=\{\{ scale: 0\.82 \}\}/);
  assert.match(source, /duration: 0\.36/);
  assert.match(source, /ease: "easeOut"/);
});

test("existing save button state is passed to the bookmark icon", () => {
  assert.match(
    source,
    /<AnimatedBookmarkIcon saved=\{Boolean\([A-Za-z_$][\w$]*\)\} \/>/,
  );
});
