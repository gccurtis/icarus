import assert from "node:assert/strict";
import { test } from "vitest";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import {
  bodyOf,
  docOf,
  emptyRow,
  repaginate,
  rowNodesOf,
  soleLiteral
} from "$app-views/categories/document-editor/procedures/projection";

const METRICS = { charactersPerLine: 40, linesPerPage: 10 };

const text = (id: string, display: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: [],
  ...over
});

const blocks = (id: string, held: ContentBlock[], proportions?: number[]): DocumentRow => ({
  id,
  kind: "blocks",
  blocks: held,
  ...(proportions === undefined ? {} : { proportions })
});

const body = (rows: DocumentRow[], over: Partial<DocumentBody> = {}): DocumentBody => ({
  rows,
  ...over
});

const words = (count: number): string => Array.from({ length: count }, () => "word").join(" ");

test("a plain body survives the round trip", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);

  assert.deepEqual(bodyOf(docOf(before, METRICS), before), before);
});

test("a proportioned row keeps its proportions", () => {
  const before = body([blocks("#r1", [text("#b1", "Title"), text("#b2", "Date")], [2, 1])]);

  assert.deepEqual(bodyOf(docOf(before, METRICS), before), before);
});

test("a divider and an explicit break are not drawn, and survive anyway", () => {
  const before = body([
    blocks("#r1", [text("#b1", "One")]),
    { id: "#r2", kind: "divider", style: "dashed", width: 2, color: "var(--token-border-strong)" },
    { id: "#r3", kind: "pageBreak" },
    blocks("#r4", [text("#b4", "Two")])
  ]);

  assert.deepEqual(
    rowNodesOf(docOf(before, METRICS)).map((row) => row.attrs.rowId),
    ["#r1", "#r4"],
    "only the rows that are display text are drawn"
  );
  assert.deepEqual(bodyOf(docOf(before, METRICS), before), before);
});

test("a mark survives an untouched round trip byte for byte", () => {
  const marked = text("#b1", "Bold words here", {
    marks: [{ id: "#m1", from: 0, to: 4, style: ["bold"] }]
  });
  const before = body([blocks("#r1", [marked])]);

  const after = bodyOf(docOf(before, METRICS), before);

  assert.deepEqual(after, before);
});

test("page setup, styles and furniture are carried, never rebuilt", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])], {
    pageSetup: { paper: "a4", orientation: "landscape", margins: { top: 1, right: 1, bottom: 1, left: 1 } },
    header: { rows: [blocks("#h1", [text("#hb1", "Head")])], distanceFromEdge: 36 }
  });

  assert.deepEqual(bodyOf(docOf(before, METRICS), before), before);
});

test("a non-text block is not drawn, and comes back in its place", () => {
  const image: ContentBlock = { id: "#b2", type: "image", alt: "A substation" };
  const before = body([blocks("#r1", [text("#b1", "One"), image], [3, 1])]);

  const doc = docOf(before, METRICS);

  assert.equal(rowNodesOf(doc)[0].childCount, 1, "the row draws its text block alone");
  assert.deepEqual(bodyOf(doc, before), before);
});

test("a text block with a formula atom is not drawn, and comes back unchanged", () => {
  const mixed: TextBlock = {
    id: "#b1",
    type: "text",
    variant: "paragraph",
    atoms: [
      { id: "#a1", kind: "literal", text: "Total " },
      {
        id: "#a2",
        kind: "formula",
        expression: "SUM(x)",
        lastResolvedValue: { kind: "number", value: 4 },
        lastResolvedDisplay: "4",
        state: "fresh"
      }
    ],
    display: "Total 4",
    marks: []
  };
  const before = body([blocks("#r1", [mixed]), blocks("#r2", [text("#b2", "Two")])]);
  const doc = docOf(before, METRICS);

  assert.equal(soleLiteral(mixed), undefined);
  assert.deepEqual(
    rowNodesOf(doc).map((row) => row.attrs.rowId),
    ["#r2"],
    "a row with nothing drawable in it is not drawn"
  );
  assert.deepEqual(bodyOf(doc, before), before);
});

test("a body with nothing drawable in it still gets a row to type into", () => {
  const before = body([{ id: "#r1", kind: "divider" }]);

  const after = bodyOf(docOf(before, METRICS), before);

  assert.equal(after.rows.length, 2);
  assert.deepEqual(after.rows[0], { id: "#r1", kind: "divider" }, "the divider is kept, in place");
  assert.equal(after.rows[1].kind, "blocks");
});

test("an empty body is given a row to put the caret in", () => {
  const doc = docOf(body([]), METRICS);

  assert.equal(doc.childCount, 1);
  assert.equal(rowNodesOf(doc).length, 1);
  assert.equal(rowNodesOf(doc)[0].type.name, "blocks_row");
});

test("a fresh row is one empty editable paragraph", () => {
  const row = emptyRow();

  assert.equal(row.kind === "blocks" && row.blocks.length, 1);
  assert.equal(row.kind === "blocks" && soleLiteral(row.blocks[0]) !== undefined, true);
});

test("rows spill onto a second page and the row nodes stay the same objects", () => {
  const before = body([
    blocks("#r1", [text("#b1", words(60))]),
    blocks("#r2", [text("#b2", words(60))])
  ]);

  const doc = docOf(before, METRICS);

  assert.equal(doc.childCount, 2);
  assert.deepEqual(bodyOf(doc, before), before);
});

test("repaginating moves a row between pages without touching its ids", () => {
  const before = body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]);
  const doc = docOf(before, METRICS);

  assert.equal(doc.childCount, 1);

  const tighter = repaginate(doc, { charactersPerLine: 40, linesPerPage: 1 });

  assert.equal(tighter.childCount, 2);
  assert.deepEqual(
    rowNodesOf(tighter).map((row) => row.attrs.rowId),
    ["#r1", "#r2"]
  );
  assert.deepEqual(bodyOf(tighter, before), before);
});

test("a page carries nothing of its own — rows are all there is on it", () => {
  const before = body([
    blocks("#r1", [text("#b1", words(60))]),
    blocks("#r2", [text("#b2", words(60))])
  ]);

  const pages = docOf(before, METRICS).children;

  assert.equal(pages.length, 2, "the rows fill two pages");
  assert.deepEqual(
    pages.map((page) => Object.keys(page.attrs)),
    [[], []]
  );
});

test("edited text lands on the display and on the sole atom", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])]);
  const doc = docOf(before, METRICS);
  const changed = doc.type.schema.node("doc", null, [
    doc.type.schema.node("page", null, [
      doc.type.schema.node(
        "blocks_row",
        { rowId: "#r1", proportions: null },
        [
          doc.type.schema.node(
            "text_block",
            { blockId: "#b1", atomId: "#b1-atom", variant: "paragraph", share: 1 },
            doc.type.schema.text("One more")
          )
        ]
      )
    ])
  ]);

  const after = bodyOf(changed, before);
  const row = after.rows[0];

  assert.equal(row.kind === "blocks" && row.blocks[0].type === "text" && row.blocks[0].display, "One more");
  assert.deepEqual(
    row.kind === "blocks" && row.blocks[0].type === "text" ? row.blocks[0].atoms : undefined,
    [{ id: "#b1-atom", kind: "literal", text: "One more" }]
  );
});
