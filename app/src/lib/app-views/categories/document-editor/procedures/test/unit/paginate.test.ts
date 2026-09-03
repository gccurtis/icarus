import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import {
  budgets,
  linesOfRow,
  linesOfText,
  paginate,
  shares,
  type BlocksRow
} from "$app-views/categories/document-editor/procedures/paginate";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}a`, kind: "literal", text: display }],
  display,
  marks: []
});

const row = (id: string, displays: readonly string[], proportions?: number[]): BlocksRow => ({
  id,
  kind: "blocks",
  blocks: displays.map((display, index) => text(`${id}b${index}`, display)),
  ...(proportions === undefined ? {} : { proportions })
});

const words = (count: number): string => Array.from({ length: count }, () => "word").join(" ");

test("absent proportions share the measure equally", () => {
  assert.deepEqual(shares(row("#r1", ["a", "b"])), [0.5, 0.5]);
});

test("proportions are relative, not absolute", () => {
  assert.deepEqual(shares(row("#r1", ["a", "b"], [2, 1])), [2 / 3, 1 / 3]);
});

test("a proportion count that disagrees with the block count is a bug", () => {
  assert.throws(() => shares(row("#r1", ["a", "b"], [1])), /2 blocks and 1 proportions/);
});

test("a block's character budget is its share of the line", () => {
  assert.deepEqual(budgets(row("#r1", ["a", "b"], [2, 1]), 90), [60, 30]);
});

test("a budget never falls below one character", () => {
  assert.deepEqual(budgets(row("#r1", ["a", "b"], [1, 1000]), 4), [1, 3]);
});

test("empty text still occupies a line", () => {
  assert.equal(linesOfText("", 40), 1);
});

test("text wraps on word boundaries", () => {
  assert.equal(linesOfText("aaa bbb ccc", 7), 2);
});

test("a word longer than the measure breaks inside itself", () => {
  assert.equal(linesOfText("aaaaaaaaaaaa", 5), 3);
});

test("the tallest block sets the row's height", () => {
  const band = row("#r1", [words(40), "short"], [1, 1]);

  assert.equal(linesOfRow(band, 90), linesOfText(words(40), 45));
});

test("a narrower block wraps sooner than a wider one", () => {
  const wide = linesOfRow(row("#r1", [words(20)], [1]), 90);
  const narrow = linesOfRow(row("#r2", [words(20), ""], [1, 5]), 90);

  assert.equal(wide < narrow, true);
});

test("rows fill a page and then start another", () => {
  const pages = paginate([row("#r1", [words(60)]), row("#r2", [words(60)])], 40, 10);

  assert.equal(pages.length, 2);
  assert.deepEqual(
    pages.map((page) => page.map((held) => held.id)),
    [["#r1"], ["#r2"]]
  );
});

test("an explicit break closes the page it sits on", () => {
  const pages = paginate(
    [row("#r1", ["one"]), { id: "#r2", kind: "pageBreak" }, row("#r3", ["two"])],
    90,
    40
  );

  assert.deepEqual(
    pages.map((page) => page.map((held) => held.id)),
    [["#r1", "#r2"], ["#r3"]]
  );
});

test("a break at the end leaves no trailing blank page", () => {
  const pages = paginate([row("#r1", ["one"]), { id: "#r2", kind: "pageBreak" }], 90, 40);

  assert.equal(pages.length, 1);
});

test("an empty body is still one page", () => {
  assert.deepEqual(paginate([], 90, 40), [[]]);
});

test("a row taller than a page gets its own", () => {
  const pages = paginate([row("#r1", ["one"]), row("#r2", [words(400)])], 40, 10);

  assert.deepEqual(
    pages.map((page) => page.map((held) => held.id)),
    [["#r1"], ["#r2"]]
  );
});

test("a divider takes one line", () => {
  assert.equal(linesOfRow({ id: "#r1", kind: "divider" }, 90), 1);
});
