import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import { flatten, outlineOf, placedRows, whereabouts } from "$app-views/categories/document-editor/procedures/outline";

const text = (id: string, display: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: [],
  ...over
});

const heading = (id: string, display: string, level: number): TextBlock =>
  text(id, display, { variant: "heading", level });

const row = (id: string, block: TextBlock): DocumentRow => ({ id, kind: "blocks", blocks: [block] });

const words = (count: number): string => Array.from({ length: count }, () => "word").join(" ");

const BODY: DocumentBody = {
  rows: [
    row("#r1", heading("#h1", "One", 1)),
    row("#r2", text("#p1", words(200))),
    row("#r3", heading("#h2", "One point one", 2)),
    row("#r4", heading("#h3", "One point two", 2)),
    row("#r5", heading("#h4", "Two", 1))
  ]
};

const METRICS = { charactersPerLine: 40, linesPerPage: 20 };

test("headings nest by level", () => {
  const outline = outlineOf(BODY, METRICS);

  assert.deepEqual(
    outline.map((section) => [section.title, section.children.map((child) => child.title)]),
    [
      ["One", ["One point one", "One point two"]],
      ["Two", []]
    ]
  );
});

test("a section knows the line it starts on and the page it lands on", () => {
  const [one, two] = outlineOf(BODY, METRICS);

  assert.equal(one.line, 1);
  assert.equal(one.page, 1);
  assert.ok(two.line > one.line);
  assert.ok(two.page > 1, "a long paragraph pushed it onto a later page");
  assert.equal(whereabouts(one), "P1");
});

test("a deeper heading with no parent still lists", () => {
  const outline = outlineOf({ rows: [row("#r1", heading("#h1", "Deep", 3))] }, METRICS);
  assert.equal(outline.length, 1);
  assert.equal(flatten(outline).length, 1);
});

test("rows are placed in order with lines accumulating across pages", () => {
  const placed = placedRows(BODY, METRICS);
  assert.deepEqual(placed.map((held) => held.rowId), ["#r1", "#r2", "#r3", "#r4", "#r5"]);
  for (let index = 1; index < placed.length; index += 1) assert.ok(placed[index].line > placed[index - 1].line);
});
