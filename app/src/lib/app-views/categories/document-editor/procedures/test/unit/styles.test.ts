import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import {
  DEFAULT_STYLES,
  applyStyleOps,
  defaultStyleOps,
  deleteStyleOps,
  duplicateStyleOps,
  inlineStyleOf,
  resolve,
  styleFieldOps,
  styleFieldsOps,
  styleSetOf,
  usageOf
} from "$app-views/categories/document-editor/procedures/styles";

const text = (id: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: "x" }],
  display: "x",
  marks: [],
  ...over
});

const BARE: DocumentBody = { rows: [{ id: "#r1", kind: "blocks", blocks: [text("#b1"), text("#b2", { style: "quote" })] }] };

test("a document with no styles reads the defaults", () => {
  assert.equal(styleSetOf(BARE), DEFAULT_STYLES);
  assert.equal(resolve(styleSetOf(BARE), undefined, undefined).name, "Body");
});

test("block layout overrides its style without taking ownership of typography", () => {
  const style = resolve(DEFAULT_STYLES, "heading-1", { lineHeight: 40 });
  assert.equal(style.lineHeight, 40);
  assert.equal(style.fontSize, 28);
  assert.equal(style.fontWeight, 600);
});

test("document line height preserves the represented pixel value without schema inference", () => {
  const set = {
    defaultKey: "body",
    styles: { body: { name: "Body", fontSize: 11, lineHeight: 16.5 } }
  };

  assert.equal(resolve(set, "body", undefined).lineHeight, 16.5);
  assert.equal(resolve(set, "body", { lineHeight: 15.95 }).lineHeight, 15.95);
});

test("the first style edit writes the default set into the document first", () => {
  const ops = styleFieldOps(BARE, "body", "fontSize", 18);
  const after = applyOps(BARE, ops);

  assert.deepEqual(ops.map((op) => op.path), ["styles", "styles/body/fontSize"]);
  assert.equal(after.styles?.styles.body.fontSize, 18);
  assert.equal(after.styles?.styles["heading-1"].fontSize, 28, "the rest of the set came along");
  assert.deepEqual(applyOps(after, invertAll(ops)), BARE);
});

test("an edit to a value already held is nothing", () => {
  assert.deepEqual(styleFieldOps(BARE, "body", "fontSize", 16), []);
  assert.deepEqual(styleFieldOps(BARE, "nope", "fontSize", 16), []);
});

test("a grouped style edit initializes defaults once and changes each requested field", () => {
  const ops = styleFieldsOps(BARE, "heading-1", {
    bold: true,
    fontWeight: undefined,
    strikethrough: true
  });
  const after = applyOps(BARE, ops);

  assert.equal(ops.filter((op) => op.path === "styles").length, 1);
  assert.equal(after.styles?.styles["heading-1"].bold, true);
  assert.equal(after.styles?.styles["heading-1"].fontWeight, undefined);
  assert.equal(after.styles?.styles["heading-1"].strikethrough, true);
});

test("style presentation resolves stored token names and combines decorations", () => {
  const css = inlineStyleOf({
    name: "Reviewed",
    color: "--token-ink-secondary",
    background: "--token-surface-panel",
    underline: true,
    strikethrough: true
  });

  assert.match(css, /color: var\(--token-ink-secondary\)/);
  assert.match(css, /background-color: var\(--token-surface-panel\)/);
  assert.match(css, /text-decoration-line: underline line-through/);
});

test("applying a style sets the key and the variant it implies", () => {
  assert.deepEqual(
    applyStyleOps(text("#b1"), "heading-2").map((op) => [op.path, op.op === "set" ? op.value : undefined]),
    [["#b1/style", "heading-2"], ["#b1/variant", "heading"], ["#b1/level", 2]]
  );
});

test("a duplicate gets a fresh key and a copy's name, and can be deleted again", () => {
  const made = duplicateStyleOps(BARE, "quote");
  const after = applyOps(BARE, made.ops);

  assert.equal(made.key, "quote-copy");
  assert.equal(after.styles?.styles["quote-copy"].name, "Quote copy");
  assert.equal(after.styles?.styles["quote-copy"].italic, true);

  const gone = applyOps(after, deleteStyleOps(after, "quote-copy"));
  assert.equal(gone.styles?.styles["quote-copy"], undefined);
});

test("the default style cannot be deleted, and another can be made the default", () => {
  assert.deepEqual(deleteStyleOps(BARE, "body"), []);

  const after = applyOps(BARE, defaultStyleOps(BARE, "quote"));
  assert.equal(after.styles?.defaultKey, "quote");
  assert.deepEqual(defaultStyleOps(after, "quote"), []);
});

test("usage counts the blocks a style resolves for, the default included", () => {
  assert.equal(usageOf(BARE, "body"), 1);
  assert.equal(usageOf(BARE, "quote"), 1);
  assert.equal(usageOf(BARE, "code"), 0);
});
