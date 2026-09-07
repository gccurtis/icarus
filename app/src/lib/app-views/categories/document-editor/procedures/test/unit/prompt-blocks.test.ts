import assert from "node:assert/strict";
import { test } from "vitest";

import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import {
  appendPromptBlock,
  promptBlocksIn
} from "$app-views/categories/document-editor/procedures/prompt-blocks";

const body: DocumentBody = {
  rows: [
    {
      id: "#source-row",
      kind: "blocks",
      blocks: [
        {
          id: "#source-block",
          type: "text",
          variant: "paragraph",
          atoms: [{ id: "#source-atom", kind: "literal", text: "Source text" }],
          display: "Source text",
          marks: []
        }
      ]
    }
  ]
};

test("appending a Prompt Block persists only placement and its Derived Output ID", () => {
  const made = appendPromptBlock(body, "derivedOutputs:9" as Id<"derivedOutputs">);

  assert.equal(made.op.after, "#source-row");
  assert.equal(made.block.derivedOutputId, "derivedOutputs:9");
  assert.equal(made.block.display, "");
  assert.deepEqual(made.block.atoms, []);

  const changed = applyOps(body, [made.op]);
  assert.equal(changed.rows.length, 2);
  assert.deepEqual(promptBlocksIn(changed), [made.block]);
});

test("prompt discovery ignores furniture and ordinary content", () => {
  const furniturePrompt: PromptBlock = {
    id: "#furniture-prompt",
    type: "prompt",
    derivedOutputId: "derivedOutputs:1" as Id<"derivedOutputs">,
    atoms: [],
    display: "",
    marks: [],
    state: "idle"
  };
  const held: DocumentBody = {
    ...body,
    header: {
      rows: [{ id: "#header-row", kind: "blocks", blocks: [furniturePrompt] }],
      distanceFromEdge: 12
    }
  };

  assert.deepEqual(promptBlocksIn(held), []);
  assert.deepEqual(promptBlocksIn(undefined), []);
});
