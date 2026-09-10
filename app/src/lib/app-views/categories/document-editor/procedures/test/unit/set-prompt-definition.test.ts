import assert from "node:assert/strict";
import { test } from "vitest";

import type { DocumentRuntime } from "$model/client/workspace-state";
import type {
  LinkedPromptBlock,
  UnlinkedPromptBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { setPromptDefinition } from "$app-views/categories/document-editor/procedures/set-prompt-definition";

const prompt = (): UnlinkedPromptBlock => ({
  id: "#prompt",
  type: "prompt",
  atoms: [{ id: "#atom", kind: "literal", text: "" }],
  display: "",
  marks: [],
  state: "idle"
});

const recordingRuntime = (received: DocumentOp[][]): DocumentRuntime => ({
  apply: (ops: readonly DocumentOp[]) => received.push([...ops])
}) as unknown as DocumentRuntime;

test("writing an unlinked draft delegates one represented document edit", () => {
  const received: DocumentOp[][] = [];
  setPromptDefinition({
    block: prompt(),
    prompt: "Which filings changed?",
    runtime: recordingRuntime(received)
  });

  assert.deepEqual(received, [[{
    op: "set",
    target: "block",
    path: "#prompt/prompt",
    value: "Which filings changed?",
    was: null
  }]]);
});

test("a linked Prompt Block cannot regain a second inline prompt owner", () => {
  const received: DocumentOp[][] = [];
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
