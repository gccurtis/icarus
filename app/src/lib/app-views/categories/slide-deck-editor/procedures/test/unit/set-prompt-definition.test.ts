import assert from "node:assert/strict";
import { test } from "vitest";

import type { SlideDeckRuntime } from "$model/client/workspace-state";
import type {
  LinkedPromptBlock,
  UnlinkedPromptBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { setPromptDefinition } from "$app-views/categories/slide-deck-editor/procedures/set-prompt-definition";

const prompt = (): UnlinkedPromptBlock => ({
  id: "#prompt",
  type: "prompt",
  atoms: [{ id: "#atom", kind: "literal", text: "" }],
  display: "",
  marks: [],
  state: "idle"
});

const recordingRuntime = (received: SlideDeckOp[][]): SlideDeckRuntime => ({
  apply: (ops: readonly SlideDeckOp[]) => received.push([...ops])
}) as unknown as SlideDeckRuntime;

test("writing an unlinked draft delegates one represented slide-deck edit", () => {
  const received: SlideDeckOp[][] = [];
  setPromptDefinition({
    block: prompt(),
    prompt: "Which risks should the slide explain?",
    runtime: recordingRuntime(received)
  });

  assert.deepEqual(received, [[{
    op: "set",
    target: "block",
    path: "#prompt/prompt",
    value: "Which risks should the slide explain?",
    was: null
  }]]);
});

test("a linked Prompt Block cannot regain a second inline prompt owner", () => {
  const received: SlideDeckOp[][] = [];
  const block: LinkedPromptBlock = {
    id: "#prompt",
    type: "prompt",
    derivedOutputId: "derivedOutputs:1" as Id<"derivedOutputs">,
    atoms: [{ id: "#atom", kind: "literal", text: "" }],
    display: "",
    marks: [],
    state: "idle"
  };
  setPromptDefinition({
    block,
    prompt: "A competing question",
    runtime: recordingRuntime(received)
  });

  assert.deepEqual(received, []);
});
