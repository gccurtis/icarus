import assert from "node:assert/strict";
import { test } from "vitest";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import { addressOfHit, hitsOf, replaceAllOps, replaceOps } from "$app-views/categories/document-editor/procedures/find";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const BODY: DocumentBody = {
  rows: [
    { id: "#r1", kind: "blocks", blocks: [text("#b1", "The cat sat on the cat mat")] },
    { id: "#r2", kind: "blocks", blocks: [text("#b2", "Cat")] }
  ]
};

test("hits are every occurrence, case folded unless asked otherwise", () => {
  assert.equal(hitsOf(BODY, "cat").length, 3);
  assert.equal(hitsOf(BODY, "cat", true).length, 2);
  assert.equal(hitsOf(BODY, "").length, 0);
});

test("a hit is addressed by its atom and offset, with the words around it", () => {
  const [first] = hitsOf(BODY, "cat");

  assert.equal(addressOfHit(first, "from"), "#b1/atoms/#b1-atom@4");
  assert.equal(addressOfHit(first, "to"), "#b1/atoms/#b1-atom@7");
  assert.equal(first.before, "The ");
  assert.equal(first.after, " sat on the cat mat");
});

test("a match across two atoms is not offered, because one text op cannot replace it", () => {
  const split: DocumentBody = {
    rows: [
      {
        id: "#r1",
        kind: "blocks",
        blocks: [
          {
            ...text("#b1", "ca" + "t"),
            atoms: [
              { id: "#a1", kind: "literal", text: "ca" },
              { id: "#a2", kind: "literal", text: "t" }
            ]
          }
        ]
      }
    ]
  };

  assert.equal(hitsOf(split, "cat").length, 0);
});

test("replacing one hit is one text op that leaves the others where they are", () => {
  const [, second] = hitsOf(BODY, "cat");
  const after = applyOps(BODY, replaceOps(second, "dog"));
  const block = after.rows[0].kind === "blocks" ? after.rows[0].blocks[0] : undefined;

  assert.equal(block?.type === "text" && block.display, "The cat sat on the dog mat");
});

test("replace all works from the end of each atom so earlier offsets stay true", () => {
  const after = applyOps(BODY, replaceAllOps(hitsOf(BODY, "cat"), "dog"));
  const displays = after.rows.map((row) => (row.kind === "blocks" && row.blocks[0].type === "text" ? row.blocks[0].display : ""));

  assert.deepEqual(displays, ["The dog sat on the dog mat", "dog"]);
});
