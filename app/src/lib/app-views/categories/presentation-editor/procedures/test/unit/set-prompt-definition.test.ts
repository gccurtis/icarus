import assert from "node:assert/strict";
import { test } from "vitest";

import type { PresentationRuntime } from "$model/client/workspace-state";
import type {
  LinkedPromptBlock,
  UnlinkedPromptBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import { setPromptDefinition } from "$app-views/categories/presentation-editor/procedures/set-prompt-definition";

const prompt = (): UnlinkedPromptBlock => ({
  id: "#prompt",
  type: "prompt",
  atoms: [{ id: "#atom", kind: "literal", text: "" }],
  display: "",
  marks: [],
  state: "idle"
});

const recordingRuntime = (received: PresentationOp[][]): PresentationRuntime => ({
  apply: (ops: readonly PresentationOp[]) => received.push([...ops])
}) as unknown as PresentationRuntime;

test("writing an unlinked draft delegates one represented presentation edit", () => {
  const received: PresentationOp[][] = [];
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
  const received: PresentationOp[][] = [];
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
