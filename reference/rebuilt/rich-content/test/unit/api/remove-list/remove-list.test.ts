import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { removeList } from "$rich-content/api/remove-list/remove-list";
import { setList } from "$rich-content/api/set-list/set-list";
import { installDatabases, linesOf, scopeFor, wholeLine } from "$rich-content/test/fixture";
import type { ListPresentation } from "$rich-content/types/formatting";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const ORDERED: ListPresentation = { kind: "ordered", start: 1, separator: ". " };

const acrossLines = (
  projection: Awaited<ReturnType<typeof display>>,
  fromLine: number,
  toLine: number
) => {
  const first = projection.lines[fromLine]!.segments[0]!;
  const last = projection.lines[toLine]!.segments.at(-1)!;
  return {
    start: { segmentId: first.id, offset: 0 },
    end: { segmentId: last.id, offset: last.text.length }
  };
};

const threeItemList = async () => {
  const created = await create(scope, "one\ntwo\nthree");
  const v1 = await display(scope, created.contentId);
  const listed = await setList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: acrossLines(v1, 0, 2),
    presentation: ORDERED
  });
  return { contentId: created.contentId, version: listed.version };
};

test("removes list membership from the selected line", async () => {
  const { contentId, version } = await threeItemList();
  const projection = await display(scope, contentId);

  await removeList(scope, {
    contentId,
    expectedVersion: version,
    range: wholeLine(projection, 0)
  });

  const after = await display(scope, contentId);
  assert.equal(after.lines[0]!.list, undefined);
  assert.equal(after.lines[1]!.list?.marker, "1", "the remaining list renumbers from its start");
});

test("removing the middle leaves one continuing list, not two", async () => {
  // They are one list with a gap in it, and restarting the second half would be
  // a renumbering nobody asked for.
  const { contentId, version } = await threeItemList();
  const projection = await display(scope, contentId);

  await removeList(scope, {
    contentId,
    expectedVersion: version,
    range: wholeLine(projection, 1)
  });

  const after = await display(scope, contentId);
  assert.equal(after.lines[1]!.list, undefined);
  assert.equal(
    new Set([after.lines[0]!.list?.listId, after.lines[2]!.list?.listId]).size,
    1,
    "the surviving items still share one list"
  );
  assert.deepEqual(linesOf(after), ["one", "two", "three"], "no text was harmed");
});

test("removing a list where there is none is not a failure", async () => {
  const created = await create(scope, "alpha");
  const v1 = await display(scope, created.contentId);

  const result = await removeList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: wholeLine(v1)
  });

  assert.equal(result.version, v1.version + 1);
  assert.equal((await display(scope, created.contentId)).lines[0]!.list, undefined);
});
