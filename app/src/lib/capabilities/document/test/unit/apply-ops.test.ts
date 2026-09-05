import assert from "node:assert/strict";
import { test } from "vitest";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
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
});

test("a refusal carries the capability's name", () => {
  assert.throws(
    () =>
      applyOps(body([blocks("#r1", [text("#b1", "One")])]), [
        { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 0, insert: "", remove: "Two" }
      ]),
    /^Error: document\/submit-document-changes .*not "Two"/
  );
});

test("a set on a block's variant applies", () => {
  const after = applyOps(body([blocks("#r1", [text("#b1", "Title")])]), [
    { op: "set", target: "block", path: "#b1/variant", value: "heading", was: "paragraph" }
  ]);

  assert.equal(
    after.rows[0].kind === "blocks" && after.rows[0].blocks[0].type === "text"
      ? after.rows[0].blocks[0].variant
      : undefined,
    "heading"
  );
});

test("a set of null clears a row's proportions", () => {
  const after = applyOps(
    body([blocks("#r1", [text("#b1", "A"), text("#b2", "B")], [2, 1])]),
    [{ op: "set", target: "row", path: "#r1/proportions", value: null, was: [2, 1] }]
  );

  assert.equal("proportions" in after.rows[0], false);
});

test("marks on an edited block move with the text of their own atom", () => {
  const marked = text("#b1", "Bold words", {
    marks: [
      { id: "#m1", from: { atom: "#b1-atom", offset: 0 }, to: { atom: "#b1-atom", offset: 4 }, style: ["bold"] }
    ]
  });
  const after = applyOps(body([blocks("#r1", [marked])]), [
    { op: "text", target: "atom", path: "#b1/atoms/#b1-atom", at: 0, insert: "Very ", remove: "" }
  ]);

  assert.deepEqual(
    after.rows[0].kind === "blocks" && after.rows[0].blocks[0].type === "text"
      ? after.rows[0].blocks[0].marks
      : undefined,
    [{ id: "#m1", from: { atom: "#b1-atom", offset: 5 }, to: { atom: "#b1-atom", offset: 9 }, style: ["bold"] }]
  );
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
