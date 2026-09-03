import assert from "node:assert/strict";
import { test } from "vitest";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import { translate } from "$app-views/categories/document-editor/procedures/translate";

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

const body = (rows: DocumentRow[]): DocumentBody => ({ rows });

test("an unchanged body emits nothing", () => {
  const before = body([blocks("#r1", [text("#b1", "One")])]);

  assert.deepEqual(translate(before, before), []);
});

test("typing at the end is one text op", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One")])]),
    body([blocks("#r1", [text("#b1", "One more")])])
  );

  assert.deepEqual(ops, [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 3, insert: " more", remove: "" }
  ]);
});

test("typing in the middle names only the changed span", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "abcf")])]),
    body([blocks("#r1", [text("#b1", "abdef")])])
  );

  assert.deepEqual(ops, [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 2, insert: "de", remove: "c" }
  ]);
});

test("deleting is a text op with an empty insert", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One more")])]),
    body([blocks("#r1", [text("#b1", "One")])])
  );

  assert.deepEqual(ops, [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 3, insert: "", remove: " more" }
  ]);
});

test("a split is the head's text op and a row insert", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "OneTwo")])]),
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])])
  );

  assert.equal(ops.length, 2);
  assert.deepEqual(ops[0], {
    op: "text",
    target: "atom",
    path: "#b1/atoms/#b1-atom",
    at: 3,
    insert: "",
    remove: "Two"
  });
  assert.equal(ops[1].op, "insert");
  assert.equal(ops[1].op === "insert" && ops[1].path, "rows");
  assert.deepEqual(ops[1].op === "insert" && ops[1].ids, ["#r2"]);
  assert.equal(ops[1].op === "insert" && ops[1].after, "#r1");
});

test("a merge is the survivor's text op and a row remove", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]),
    body([blocks("#r1", [text("#b1", "OneTwo")])])
  );

  assert.equal(ops.length, 2);
  assert.equal(ops[0].op, "text");
  assert.equal(ops[1].op, "remove");
  assert.deepEqual(ops[1].op === "remove" && ops[1].ids, ["#r2"]);
  assert.equal(ops[1].op === "remove" && ops[1].after, "#r1");
});

test("a removed first row anchors on null", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]),
    body([blocks("#r2", [text("#b2", "Two")])])
  );

  assert.deepEqual(ops, [
    {
      op: "remove",
      target: "row",
      path: "rows",
      ids: ["#r1"],
      after: null,
      values: [blocks("#r1", [text("#b1", "One")])]
    }
  ]);
});

test("a changed proportion is a set on the row", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [2, 1])]),
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [3, 1])])
  );

  assert.deepEqual(ops, [
    { op: "set", target: "row", path: "#r1/proportions", value: [3, 1], was: [2, 1] }
  ]);
});

test("a variant is not this editor's to change, so it emits nothing", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "Title")])]),
    body([blocks("#r1", [text("#b1", "Title", { variant: "heading" })])])
  );

  assert.deepEqual(ops, []);
});

test("a reorder is a move against the id it now follows", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]),
    body([blocks("#r2", [text("#b2", "Two")]), blocks("#r1", [text("#b1", "One")])])
  );

  assert.deepEqual(ops, [
    { op: "move", target: "row", path: "rows", id: "#r2", after: null, wasAfter: "#r1" },
    { op: "move", target: "row", path: "rows", id: "#r1", after: "#r2", wasAfter: null }
  ]);
});

test("a mark-only difference is not this translator's business", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "One")])]),
    body([
      blocks("#r1", [text("#b1", "One", { marks: [{ id: "#m1", from: 0, to: 3, style: ["bold"] }] })])
    ])
  );

  assert.deepEqual(ops, []);
});

test("a held non-text block emits nothing", () => {
  const image: ContentBlock = { id: "#b2", type: "image", alt: "A substation" };
  const before = body([blocks("#r1", [text("#b1", "One"), image], [3, 1])]);

  assert.deepEqual(translate(before, before), []);
});

test("a block added inside a row is an insert against the row's block list", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "A")])]),
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")])])
  );

  assert.deepEqual(ops, [
    {
      op: "insert",
      target: "block",
      path: "#r1/blocks",
      ids: ["#b2"],
      after: "#b1",
      values: [text("#b2", "B")]
    }
  ]);
});

test("a block removed from a row is a remove against the row's block list", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")])]),
    body([blocks("#r1", [text("#b1", "A")])])
  );

  assert.deepEqual(ops, [
    {
      op: "remove",
      target: "block",
      path: "#r1/blocks",
      ids: ["#b2"],
      after: "#b1",
      values: [text("#b2", "B")]
    }
  ]);
});

test("edits come before removals, removals before insertions", () => {
  const ops = translate(
    body([blocks("#r1", [text("#b1", "OneTwo")]), blocks("#r2", [text("#b2", "Gone")])]),
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r3", [text("#b3", "Two")])])
  );

  assert.deepEqual(
    ops.map((op) => op.op),
    ["text", "remove", "insert"]
  );
});
