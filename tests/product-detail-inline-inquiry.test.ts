import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const detail = source("src/components/database-public-detail.tsx");
const composer = source("src/components/product-inquiry-composer.tsx");
const textarea = source("src/components/ui/textarea.tsx");
const saveButton = source("src/components/save-button.tsx");
const english = source("messages/en.json");
const korean = source("messages/ko.json");

test("product summary moves save and share actions to the top right", () => {
  assert.match(detail, /flex items-start justify-between gap-4/);
  assert.match(detail, /<SaveButton id=\{product\.id\} kind="product" iconOnly \/>/);
  assert.match(detail, /<ProductShareButton[\s\S]*!border-0[\s\S]*!bg-transparent/);
  const summaryStart = detail.indexOf(
    'className="sticky top-20 min-w-0 border border-zinc-200 bg-white',
  );
  const summary = detail.slice(summaryStart, detail.indexOf("</section>", summaryStart));
  assert.ok(
    summary.indexOf("<SaveButton") < summary.indexOf("<h1"),
    "Save and Share must appear before the product title",
  );
});

test("product summary replaces seller CTA block with inline inquiry composer", () => {
  assert.match(detail, /<ProductInquiryComposer[\s\S]*product=\{product\}/);
  assert.doesNotMatch(detail, /requestableHiddenFields/);
  assert.doesNotMatch(detail, /productDetail\.hiddenFieldsHelp/);
  assert.doesNotMatch(detail, /productDetail\.requestDetails/);
  assert.doesNotMatch(
    detail,
    /<ContactModal[\s\S]{0,180}context=\{\{ type: "product", product \}\}/,
  );
});

test("send button is inside the textarea at the bottom right", () => {
  assert.match(composer, /<Field>/);
  assert.match(composer, /<FieldLabel/);
  assert.match(composer, /<FieldDescription>/);
  assert.match(composer, /<Textarea/);
  assert.match(composer, /className="min-h-36 resize-none pb-16 pr-28"/);
  assert.match(
    composer,
    /className="absolute bottom-3 right-3 h-9 rounded-lg px-4"/,
  );
  assert.match(composer, /<SendIcon \/>/);
  assert.match(
    composer,
    /M10\.4995 13\.5001L20\.9995 3\.00005M10\.6271 13\.8281/,
  );
});

test("inline inquiry sends the typed message through the existing API", () => {
  assert.match(composer, /fetch\("\/api\/inquiries"/);
  assert.match(composer, /targetCompanyId: product\.sellerId/);
  assert.match(composer, /productId: product\.id/);
  assert.match(composer, /message: trimmedMessage/);
  assert.match(composer, /messageRoute/);
  assert.match(composer, /safeInternalPath\(route, "\/messages"\)/);
});

test("textarea and new copy use semantic shadcn tokens", () => {
  assert.match(textarea, /border-input/);
  assert.match(textarea, /bg-background/);
  assert.match(textarea, /text-foreground/);
  assert.match(textarea, /placeholder:text-muted-foreground/);
  assert.doesNotMatch(textarea, /zinc-|slate-|green-|emerald-|#[0-9a-fA-F]{3,8}/);
  assert.match(english, /"messageDescription": "Enter your message below\."/);
  assert.match(english, /"send": "Send"/);
  assert.match(korean, /"messageDescription": "아래에 메시지를 입력하세요\."/);
  assert.match(korean, /"send": "보내기"/);
});

test("save control no longer renders Saved or Removed feedback popups", () => {
  assert.doesNotMatch(saveButton, /const \[feedback, setFeedback\]/);
  assert.doesNotMatch(saveButton, /setFeedback\(/);
  assert.doesNotMatch(saveButton, /role="status"/);
});
