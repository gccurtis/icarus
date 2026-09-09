import assert from "node:assert/strict";
import { test } from "vitest";

import type { Id } from "$representation/data/types/core/id";
import {
  announcePromptOutput,
  observePromptOutput
} from "$app-views/categories/document-editor/procedures/prompt-output-events";

test("a Derived Output change reloads only its mounted projections", () => {
  const one = "derivedOutputs:1" as Id<"derivedOutputs">;
  const two = "derivedOutputs:2" as Id<"derivedOutputs">;
  const target = new EventTarget();
  let seen = 0;
  const stop = observePromptOutput(one, () => {
    seen += 1;
  }, target);

  announcePromptOutput(two, target);
  assert.equal(seen, 0);

  announcePromptOutput(one, target);
  assert.equal(seen, 1);

  stop();
  announcePromptOutput(one, target);
  assert.equal(seen, 1);
});
