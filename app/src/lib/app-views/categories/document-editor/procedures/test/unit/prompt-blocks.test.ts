import assert from "node:assert/strict";
import { test } from "vitest";

import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import type {
  LinkedPromptBlock,
  PromptBlock,
  UnlinkedPromptBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type { DocumentRuntime } from "$model/client/workspace-state";
import {
  linkPromptBlockOps,
  promptBlocksIn,
  syncPromptBlockOps
} from "$app-views/categories/document-editor/procedures/prompt-blocks";
import { promptDefinitionOps } from "$app-views/categories/document-editor/procedures/prompt-definition";
import { publishPromptOutput } from "$app-views/categories/document-editor/procedures/publish-prompt-output";

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

const prompt = (): UnlinkedPromptBlock => ({
  id: "#prompt",
  type: "prompt",
  atoms: [{ id: "#prompt-atom", kind: "literal", text: "Old answer" }],
  display: "Old answer",
  marks: [
    {
      id: "#mark",
      from: { atom: "#prompt-atom", offset: 0 },
      to: { atom: "#prompt-atom", offset: 10 },
      style: ["bold"]
    }
  ],
  state: "idle"
});

const output = (display = "A longer current answer"): DerivedOutput => ({
  _id: "derivedOutputs:9" as Id<"derivedOutputs">,
  _creationTime: 1,
  projectId: "projects:1" as Id<"projects">,
  prompt: "What changed?",
  definitionRevision: 1,
  valueSource: "generated",
  queries: [],
  evidence: [],
  lastResponse: {
    id: "#answer",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "#answer-atom", kind: "literal", text: display }],
    display,
    marks: []
  },
  lastRevision: 1,
  lastGeneration: 1,
  state: "fresh",
  refreshedAt: 12,
  createdBy: { kind: "system" },
  updatedAt: 12
});

/**
 * Linking hands the scope over, rather than copying it.
 *
 * Two places holding a scope is two places that can disagree, and only one of
 * them is what the agent obeys. So the block keeps one until there is an output
 * to keep it, and gives it up at the moment there is.
 */
test("an unlinked Prompt Block keeps its authored question in the document body", () => {
  const block = prompt();
  const authored = "  Which filings changed?  ";
  const changed = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    promptDefinitionOps(block, authored)
  );
  const defined = changed.rows[0].kind === "blocks" ? changed.rows[0].blocks[0] : undefined;

  assert.equal(defined?.type === "prompt" && defined.prompt, authored);
});

test("clearing an unlinked Prompt Block removes its represented question", () => {
  const block = { ...prompt(), prompt: "Which filings changed?" };
  const changed = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    promptDefinitionOps(block, "   ")
  );
  const cleared = changed.rows[0].kind === "blocks" ? changed.rows[0].blocks[0] : undefined;

  assert.equal(cleared?.type === "prompt" && "prompt" in cleared, false);
});

test("linking a Prompt Block takes the Derived Output identity and gives up its question and scope", () => {
  const block = {
    ...prompt(),
    prompt: "Which filings changed?",
    scope: { include: [{ select: "project" as const }], exclude: [] }
  };
  const changed = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    linkPromptBlockOps(block, "derivedOutputs:9" as Id<"derivedOutputs">)
  );
  const linked = changed.rows[0].kind === "blocks" ? changed.rows[0].blocks[0] : undefined;

  assert.equal(linked?.type === "prompt" && linked.derivedOutputId, "derivedOutputs:9");
  assert.equal(linked?.type === "prompt" && "prompt" in linked, false);
  assert.equal(linked?.type === "prompt" && "scope" in linked, false);
  assert.equal(linked?.type === "prompt" && linked.display, "Old answer");
});

test("publishing a response replaces editable text and preserves author formatting", () => {
  const block = prompt();
  const changed = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    [
      ...linkPromptBlockOps(block, "derivedOutputs:9" as Id<"derivedOutputs">),
      ...syncPromptBlockOps(block, output())
    ]
  );
  const synced = changed.rows[0].kind === "blocks" ? changed.rows[0].blocks[0] : undefined;

  assert.equal(synced?.type === "prompt" && synced.display, "A longer current answer");
  assert.equal(synced?.type === "prompt" && synced.state, "fresh");
  assert.equal(synced?.type === "prompt" && synced.refreshedAt, 12);
  assert.deepEqual(synced?.type === "prompt" && synced.marks[0].to, {
    atom: "#prompt-atom",
    offset: 10
  });
});

test("publishing a shorter response clips mark ranges without teaching Derived Output about marks", () => {
  const block = prompt();
  const shorter = output("Short");
  const changed = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    [
      ...linkPromptBlockOps(block, "derivedOutputs:9" as Id<"derivedOutputs">),
      ...syncPromptBlockOps(block, shorter)
    ]
  );
  const synced = changed.rows[0].kind === "blocks" ? changed.rows[0].blocks[0] : undefined;

  assert.deepEqual(synced?.type === "prompt" && synced.marks[0], {
    id: "#mark",
    from: { atom: "#prompt-atom", offset: 0 },
    to: { atom: "#prompt-atom", offset: 5 },
    style: ["bold"]
  });
});

test("a delayed publication is persisted after the block was linked", async () => {
  const block = prompt();
  let current = applyOps(
    { rows: [{ id: "#row", kind: "blocks", blocks: [block] }] },
    linkPromptBlockOps(block, "derivedOutputs:9" as Id<"derivedOutputs">)
  );
  let flushes = 0;
  const runtime = {
    get body() { return current; },
    apply: (ops: Parameters<typeof applyOps>[1]) => { current = applyOps(current, ops); },
    flush: async () => { flushes += 1; },
    failure: undefined
  } as unknown as DocumentRuntime;

  await publishPromptOutput({ blockId: "#prompt", output: output("Delayed answer"), runtime });
  await publishPromptOutput({ blockId: "#prompt", output: output("Delayed answer"), runtime });

  const published = current.rows[0].kind === "blocks" ? current.rows[0].blocks[0] : undefined;
  assert.equal(published?.type === "prompt" && published.display, "Delayed answer");
  assert.equal(published?.type === "prompt" && published.state, "fresh");
  assert.equal(flushes, 1);

  current = applyOps(current, [
    { op: "set", target: "block", path: "#prompt/display", value: "Local edit", was: "Delayed answer" },
    { op: "set", target: "block", path: "#prompt/state", value: "stale", was: "fresh" }
  ]);
  await publishPromptOutput({ blockId: "#prompt", output: output("Delayed answer"), runtime });
  const locallyEdited = current.rows[0].kind === "blocks" ? current.rows[0].blocks[0] : undefined;
  assert.equal(locallyEdited?.type === "prompt" && locallyEdited.display, "Local edit");
  assert.equal(flushes, 1);
});

test("prompt discovery ignores furniture and ordinary content", () => {
  const furniturePrompt: LinkedPromptBlock = {
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
