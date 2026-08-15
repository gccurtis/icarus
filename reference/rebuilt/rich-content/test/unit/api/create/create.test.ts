import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { installDatabases, linesOf, scopeFor } from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

test("creates empty content at version 1", async () => {
  const created = await create(scope);

  assert.equal(created.version, 1);
  // Shape and relationship, not a literal. Identity is generated, and asserting
  // `content-1` here would be testing the fixture rather than the capability.
  assert.ok(created.contentId.length > 0);
  assert.deepEqual(linesOf(await display(scope, created.contentId)), [""]);
});

test("the id a mutation returns is the id display reports", async () => {
  const created = await create(scope, "hello");

  assert.equal((await display(scope, created.contentId)).contentId, created.contentId);
});

test("two creations are two different objects", async () => {
  const first = await create(scope, "one");
  const second = await create(scope, "two");

  assert.notEqual(first.contentId, second.contentId);
  assert.deepEqual(linesOf(await display(scope, first.contentId)), ["one"]);
  assert.deepEqual(linesOf(await display(scope, second.contentId)), ["two"]);
});

test("a newline becomes a line, including a trailing empty one", async () => {
  // Every logical line gets exactly one addressable text atom — the invariant
  // `rawLines` and `lineRange` depend on.
  const created = await create(scope, "first\nsecond\n");

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["first", "second", ""]);
});

test("content of only newlines is all empty lines", async () => {
  const created = await create(scope, "\n\n");

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["", "", ""]);
});
