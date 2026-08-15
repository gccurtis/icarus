import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { combineAsList } from "$rich-content/api/combine-as-list/combine-as-list";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { RichContentError } from "$rich-content/errors";
import {
  installDatabases,
  linesOf,
  scopeFor,
  withinFirstSegment
} from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const UNORDERED = { kind: "unordered", marker: "•", separator: " " } as const;
const ORDERED = { kind: "ordered", start: 1, separator: ". " } as const;

const code = (expected: string) => (error: unknown): boolean =>
  error instanceof RichContentError && error.code === expected;

const itemsOf = async (ids: readonly string[]) =>
  Promise.all(
    ids.map(async (id) => ({ contentId: id, expectedVersion: (await display(scope, id)).version }))
  );

test("many objects become one, and every source stops existing", async () => {
  const first = await create(scope, "alpha");
  const second = await create(scope, "beta");

  const combined = await combineAsList(scope, {
    items: await itemsOf([first.contentId, second.contentId]),
    presentation: UNORDERED
  });

  assert.notEqual(combined.contentId, first.contentId);
  assert.notEqual(combined.contentId, second.contentId);
  assert.deepEqual(linesOf(await display(scope, combined.contentId)), ["alpha", "beta"]);

  for (const source of [first, second]) {
    await assert.rejects(() => display(scope, source.contentId), code("content-not-found"));
  }
});

test("caller order is the list order", async () => {
  const first = await create(scope, "alpha");
  const second = await create(scope, "beta");

  const combined = await combineAsList(scope, {
    items: await itemsOf([second.contentId, first.contentId]),
    presentation: UNORDERED
  });

  assert.deepEqual(linesOf(await display(scope, combined.contentId)), ["beta", "alpha"]);
});

test("every line becomes an item of one list, numbered in order", async () => {
  const ids = [];
  for (const text of ["one", "two", "three"]) ids.push((await create(scope, text)).contentId);

  const combined = await combineAsList(scope, {
    items: await itemsOf(ids),
    presentation: ORDERED
  });

  const projection = await display(scope, combined.contentId);
  const markers = projection.lines.map((line) => line.list?.marker);
  const listIds = new Set(projection.lines.map((line) => line.list?.listId));

  assert.deepEqual(markers, ["1", "2", "3"]);
  assert.equal(listIds.size, 1, "all three items belong to one list");
});

test("inline formatting survives, because the copy is atom-based", async () => {
  const first = await create(scope, "alpha");
  const v1 = await display(scope, first.contentId);
  await applyStyle(scope, {
    contentId: first.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3),
    properties: { bold: true }
  });
  const second = await create(scope, "beta");

  const combined = await combineAsList(scope, {
    items: await itemsOf([first.contentId, second.contentId]),
    presentation: UNORDERED
  });

  const projection = await display(scope, combined.contentId);
  assert.ok(
    projection.lines[0]!.segments.some(({ style }) => style.bold),
    "the bold run came through"
  );
  assert.deepEqual(linesOf(projection), ["alpha", "beta"]);
});

test("a duplicated source is refused before anything is read", async () => {
  // Otherwise it would be deleted once and counted twice, and the second delete
  // would report stale-version for a reason that is not concurrency.
  const only = await create(scope, "alpha");
  const items = await itemsOf([only.contentId]);

  await assert.rejects(
    () => combineAsList(scope, { items: [...items, ...items], presentation: UNORDERED }),
    code("invalid-list-source")
  );

  assert.deepEqual(linesOf(await display(scope, only.contentId)), ["alpha"]);
});

test("an empty item set is refused", async () => {
  await assert.rejects(
    () => combineAsList(scope, { items: [], presentation: UNORDERED }),
    code("invalid-list-source")
  );
});

test("a multi-line source must be split first", async () => {
  const multi = await create(scope, "one\ntwo");
  const items = await itemsOf([multi.contentId]);

  await assert.rejects(
    () => combineAsList(scope, { items, presentation: UNORDERED }),
    code("invalid-list-source")
  );
});

test("one stale source abandons the whole combine, losing nothing", async () => {
  // The property that matters: combining a stale subset would silently discard
  // whatever the other writer added to the source that moved.
  const first = await create(scope, "alpha");
  const second = await create(scope, "beta");
  const items = await itemsOf([first.contentId, second.contentId]);

  const v1 = await display(scope, second.contentId);
  await applyStyle(scope, {
    contentId: second.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 2),
    properties: { bold: true }
  });

  await assert.rejects(
    () => combineAsList(scope, { items, presentation: UNORDERED }),
    code("stale-version")
  );

  assert.deepEqual(linesOf(await display(scope, first.contentId)), ["alpha"]);
  assert.deepEqual(linesOf(await display(scope, second.contentId)), ["beta"]);
});

test("a list marker containing a line break is refused", async () => {
  const only = await create(scope, "alpha");
  const items = await itemsOf([only.contentId]);

  await assert.rejects(
    () =>
      combineAsList(scope, {
        items,
        presentation: { kind: "unordered", marker: "•\n", separator: " " }
      }),
    code("invalid-list-presentation")
  );
});
