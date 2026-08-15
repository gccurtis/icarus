import assert from "node:assert/strict";
import { test } from "vitest";
import { atomId, contentId, listId, markId } from "$rich-content/api/shared/ids";

/**
 * What the backend asserted with a counting factory — `content-1`, `atom-2` —
 * becomes an assertion on shape and distinctness, because those literals were
 * testing the fixture rather than the capability.
 *
 * What is genuinely worth stating is the prefix, because it is the thing that
 * makes an id self-describing in a stored `jsonb` row and in a log line.
 */
test("each kind carries its own prefix", () => {
  assert.ok(contentId().startsWith("content_"));
  assert.ok(atomId().startsWith("atom_"));
  assert.ok(markId().startsWith("mark_"));
  assert.ok(listId().startsWith("list_"));
});

test("two allocations differ", () => {
  assert.notEqual(contentId(), contentId());
  assert.notEqual(atomId(), atomId());
});

test("one kind is never mistaken for another", () => {
  const allocated = [contentId(), atomId(), markId(), listId()];

  assert.equal(new Set(allocated).size, 4);
  assert.equal(allocated.filter((id) => id.startsWith("content_")).length, 1);
});
