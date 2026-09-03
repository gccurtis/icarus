import assert from "node:assert/strict";
import { test } from "vitest";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { applyOps } from "$capabilities/document/api/submit-document-changes/apply-ops";

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

const displays = (after: DocumentBody): readonly string[][] =>
  after.rows.map((row) =>
    row.kind === "blocks" ? row.blocks.map((block) => ("display" in block ? block.display : "")) : []
  );

test("a text op splices the atom and rebuilds the display", () => {
  const after = applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 3, insert: " more", remove: "" }
  ]);

  assert.deepEqual(displays(after), [["One more"]]);
  assert.deepEqual(
    after.rows[0].kind === "blocks" && after.rows[0].blocks[0].type === "text"
      ? after.rows[0].blocks[0].atoms
      : undefined,
    [{ id: "#b1-atom", kind: "literal", text: "One more" }]
  );
});

test("a text op authored against text that has moved is refused", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
        { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 0, insert: "", remove: "Two" }
      ]),
    /not "Two"/
  );
});

test("a text op naming an atom that is not there is refused", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
        { op: "text", target: "atom", path: "#b1/atoms/#gone", at: 0, insert: "x", remove: "" }
      ]),
    /No atom #gone/
  );
});

test("a row insert lands after the id it names", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r3", [text("#b3", "Three")])]),
    [
      {
        op: "insert",
        target: "row",
        path: "rows",
        ids: ["#r2"],
        after: "#r1",
        values: [blocks("#r2", [text("#b2", "Two")])]
      }
    ]
  );

  assert.deepEqual(
    after.rows.map((row) => row.id),
    ["#r1", "#r2", "#r3"]
  );
});

test("a row insert anchored on null lands at the front", () => {
  const after = applyOps(body([blocks("#r2", [text("#b2", "Two")])]), [
    {
      op: "insert",
      target: "row",
      path: "rows",
      ids: ["#r1"],
      after: null,
      values: [blocks("#r1", [text("#b1", "One")])]
    }
  ]);

  assert.deepEqual(
    after.rows.map((row) => row.id),
    ["#r1", "#r2"]
  );
});

test("an insert anchored on a row that is gone is refused", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
        { op: "insert", target: "row", path: "rows", ids: ["#r2"], after: "#gone", values: [] }
      ]),
    /Nothing with id #gone/
  );
});

test("a row remove drops it", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]),
    [
      {
        op: "remove",
        target: "row",
        path: "rows",
        ids: ["#r2"],
        after: "#r1",
        values: [blocks("#r2", [text("#b2", "Two")])]
      }
    ]
  );

  assert.deepEqual(
    after.rows.map((row) => row.id),
    ["#r1"]
  );
});

test("a remove naming a row that is gone is refused", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
        { op: "remove", target: "row", path: "rows", ids: ["#gone"], after: null, values: [] }
      ]),
    /to remove/
  );
});

test("a move reorders the rows", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "One")]), blocks("#r2", [text("#b2", "Two")])]),
    [{ op: "move", target: "row", path: "rows", id: "#r2", after: null, wasAfter: "#r1" }]
  );

  assert.deepEqual(
    after.rows.map((row) => row.id),
    ["#r2", "#r1"]
  );
});

test("a set writes a row's proportions", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [2, 1])]),
    [{ op: "set", target: "row", path: "#r1/proportions", value: [3, 1], was: [2, 1] }]
  );

  assert.deepEqual(after.rows[0].kind === "blocks" ? after.rows[0].proportions : undefined, [3, 1]);
});

test("a set of null clears a row's proportions", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [2, 1])]),
    [{ op: "set", target: "row", path: "#r1/proportions", value: null, was: [2, 1] }]
  );

  assert.equal("proportions" in after.rows[0], false);
});

test("a set on a block's variant is not something this applier can approve", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "Title")])]), [
        { op: "set", target: "block", path: "#b1/variant", value: "heading", was: "paragraph" }
      ]),
    /cannot apply set on block/
  );
});

test("a block insert and remove reach a row's block list", () => {
  const added = applyOps(body([blocks("#r1", [text("#b1", "A")])]), [
    {
      op: "insert",
      target: "block",
      path: "#r1/blocks",
      ids: ["#b2"],
      after: "#b1",
      values: [text("#b2", "B")]
    }
  ]);

  assert.deepEqual(displays(added), [["A", "B"]]);

  const removed = applyOps(added, [
    {
      op: "remove",
      target: "block",
      path: "#r1/blocks",
      ids: ["#b1"],
      after: null,
      values: [text("#b1", "A")]
    }
  ]);

  assert.deepEqual(displays(removed), [["B"]]);
});

test("a mark op is not something this applier can approve", () => {
  const op: DocumentOp = {
    op: "set",
    target: "mark",
    path: "#b1/marks/#m1",
    value: { style: ["bold"] },
    was: null
  };

  assert.throws(() => applyOps(body([blocks("#r1", [text("#b1", "One")])]), [op]), /cannot apply set on mark/);
});

test("a whole change set applies in order", () => {
  const after = applyOps(body([blocks("#r1", [text("#b1", "OneTwo")])]), [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 3, insert: "", remove: "Two" },
    {
      op: "insert",
      target: "row",
      path: "rows",
      ids: ["#r2"],
      after: "#r1",
      values: [blocks("#r2", [text("#b2", "Two")])]
    }
  ]);

  assert.deepEqual(displays(after), [["One"], ["Two"]]);
});

test("marks on an edited block are left exactly as they were", () => {
  const marked = text("#b1", "Bold words", {
    marks: [{ id: "#m1", from: 0, to: 4, style: ["bold"] }]
  });
  const after = applyOps(body([blocks("#r1", [marked])]), [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 10, insert: "!", remove: "" }
  ]);

  assert.deepEqual(
    after.rows[0].kind === "blocks" && after.rows[0].blocks[0].type === "text"
      ? after.rows[0].blocks[0].marks
      : undefined,
    [{ id: "#m1", from: 0, to: 4, style: ["bold"] }]
  );
});
