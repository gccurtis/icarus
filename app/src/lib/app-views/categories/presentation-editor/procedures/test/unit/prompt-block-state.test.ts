import assert from "node:assert/strict";
import { test } from "vitest";

import { PromptBlockState } from "$app-views/categories/presentation-editor/inspector/prompt-block.state.svelte";

test("draft state hydrates from represented prompts and preserves a draft until its body echo", () => {
  const state = new PromptBlockState();
  state.select("#first", "Initial question");
  assert.equal(state.promptDraft, "Initial question");

  state.promptDraft = "Question being represented";
  state.select("#first", "Concurrent represented question");
  assert.equal(state.promptDraft, "Question being represented");

  state.select("#first", "Question being represented");
  assert.equal(state.promptDraft, "Question being represented");
  assert.equal(state.representedPrompt, "Question being represented");

  state.select("#second", undefined);
  assert.equal(state.promptDraft, "");
  assert.equal(state.actionError, undefined);
});
