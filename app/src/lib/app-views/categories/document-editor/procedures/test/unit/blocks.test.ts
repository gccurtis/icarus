import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import {
  agree,
  blockTypeOps,
  formatOps,
  placementOf,
  tableShapeOps,
  emptyTable
} from "$app-views/categories/document-editor/procedures/blocks";

const text = (id: string, display: string, over: Partial<TextBlock> = {}): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: [],
  ...over
});

const body = (): DocumentBody => ({
  rows: [
    { id: "#r1", kind: "blocks", blocks: [text("#b1", "One")] },
    { id: "#r2", kind: "blocks", blocks: [text("#b2", "Two"), text("#b3", "Three")], proportions: [1, 1] }
  ]
});

test("agreement is the one value everything holds, or mixed", () => {
  assert.deepEqual(agree([1, 1]), { value: 1, mixed: false });
  assert.deepEqual(agree([1, 2]), { value: undefined, mixed: true });
  assert.deepEqual(agree([]), { value: undefined, mixed: false });
});

test("a format patch writes the merged format and remembers what was there", () => {
  const block = text("#b1", "One", { format: { lineHeight: 18 } });
  const [op] = formatOps(block, { horizontalAlignment: "center" });

  assert.deepEqual(op, {
    op: "set",
    target: "block",
    path: "#b1/format",
    value: { lineHeight: 18, horizontalAlignment: "center" },
    was: { lineHeight: 18 }
  });
});

test("clearing the last format field clears the format", () => {
  const block = text("#b1", "One", { format: { lineHeight: 18 } });
  const [op] = formatOps(block, { lineHeight: null });

  assert.equal(op.op === "set" && op.value, null);
  assert.equal(formatOps(text("#b1", "One"), { lineHeight: null }).length, 0, "nothing to clear");
});

test("changing a block to a table swaps it inside its row and inverts cleanly", () => {
  const before = body();
  const ops = blockTypeOps(before, "#b3", "table");
  const after = applyOps(before, ops);
  const row = after.rows[1];

  assert.deepEqual(ops.map((op) => op.op), ["remove", "insert"]);
  assert.equal(row.kind === "blocks" && row.blocks[1].type, "table");
  assert.equal(row.kind === "blocks" && row.blocks[0].id, "#b2");
  assert.deepEqual(applyOps(after, invertAll(ops)), before);
});

test("changing an empty line to Prompt creates editable prompt text", () => {
  const before = body();
  const after = applyOps(before, blockTypeOps(before, "#b1", "prompt"));
  const held = after.rows[0].kind === "blocks" ? after.rows[0].blocks[0] : undefined;

  assert.equal(held?.type, "prompt");
  assert.equal(held?.type === "prompt" && held.state, "idle");
  assert.equal(held?.type === "prompt" && held.atoms[0]?.kind, "literal");
  assert.equal(held?.type === "prompt" && held.display, "");
});

test("changing a block to a page break replaces its row", () => {
  const before = body();
  const after = applyOps(before, blockTypeOps(before, "#b1", "pageBreak"));

  assert.equal(after.rows[0].kind, "pageBreak");
  assert.equal(after.rows[1].id, "#r2");
});

test("asking for the kind a block already is does nothing", () => {
  assert.deepEqual(blockTypeOps(body(), "#b1", "text"), []);
});

test("a table grows and shrinks by whole rows and columns", () => {
  const table = emptyTable(2, 2);
  const grown = applyOps(
    { rows: [{ id: "#r", kind: "blocks", blocks: [table] }] },
    tableShapeOps(table, { rows: 3, columns: 3, headerRows: 2 })
  );
  const held = grown.rows[0].kind === "blocks" ? grown.rows[0].blocks[0] : undefined;

  assert.equal(held?.type === "table" && held.rows.length, 3);
  assert.equal(held?.type === "table" && held.rows[0].cells.length, 3);
  assert.equal(held?.type === "table" && held.rows[0].cells[0].id, table.rows[0].cells[0].id, "kept the cells it had");
  assert.equal(held?.type === "table" && held.headerRows, 2);
});

test("placement says where in its row a block sits and the page it lands on", () => {
  assert.deepEqual(placementOf(body(), "#b3", { charactersPerLine: 40, linesPerPage: 40 }), {
    index: 2,
    of: 2,
    page: 1
  });
  assert.equal(placementOf(body(), "#gone", { charactersPerLine: 40, linesPerPage: 40 }), undefined);
});
