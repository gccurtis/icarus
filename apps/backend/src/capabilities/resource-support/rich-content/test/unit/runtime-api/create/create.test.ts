import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";
import { PersistedRichContentRuntime } from "#rich-content/runtime-objects/rich-content/definition.js";

test("persists content and renders editable display handles", async (context) => {
  const { ids, runtime, store } = await fixture(context);
  const created = await runtime.create("first\nsecond");
  const display = await runtime.display(created.contentId);

  assert.deepEqual(created, { contentId: "content-1", version: 1 });
  assert.deepEqual(
    display.lines.map((line) => line.segments[0]?.text),
    ["first", "second"]
  );
  assert.equal("atoms" in display, false);
  assert.equal("marks" in display, false);

  const recreated = new PersistedRichContentRuntime(store, ids);
  assert.deepEqual(await recreated.display(created.contentId), display);
});
