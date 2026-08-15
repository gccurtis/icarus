import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { setList } from "$rich-content/api/set-list/set-list";
import { RichContentError } from "$rich-content/errors";
import { installDatabases, scopeFor, wholeLine } from "$rich-content/test/fixture";
import type { ListPresentation } from "$rich-content/types/formatting";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const UNORDERED: ListPresentation = { kind: "unordered", marker: "•", separator: " " };
const ORDERED: ListPresentation = { kind: "ordered", start: 1, separator: ". " };

const invalidPresentation = (error: unknown): boolean =>
  error instanceof RichContentError && error.code === "invalid-list-presentation";

/** A range spanning from the first line to the given one. */
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

test("marks the selected line as a list item", async () => {
  const created = await create(scope, "alpha");
  const v1 = await display(scope, created.contentId);

  await setList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: wholeLine(v1),
    presentation: UNORDERED
  });

  assert.equal((await display(scope, created.contentId)).lines[0]!.list?.marker, "•");
});

test("an ordered list numbers its lines in order", async () => {
  const created = await create(scope, "one\ntwo\nthree");
  const v1 = await display(scope, created.contentId);

  await setList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: acrossLines(v1, 0, 2),
    presentation: ORDERED
  });

  assert.deepEqual(
    (await display(scope, created.contentId)).lines.map((line) => line.list?.marker),
    ["1", "2", "3"]
  );
});

test("an adjacent matching list is joined rather than restarted", async () => {
  // Without the join, extending an ordered list would silently renumber it.
  const created = await create(scope, "one\ntwo");
  const v1 = await display(scope, created.contentId);

  const first = await setList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: wholeLine(v1, 0),
    presentation: ORDERED
  });
  const v2 = await display(scope, created.contentId);

  await setList(scope, {
    contentId: created.contentId,
    expectedVersion: first.version,
    range: wholeLine(v2, 1),
    presentation: ORDERED
  });

  const after = await display(scope, created.contentId);
  assert.deepEqual(
    after.lines.map((line) => line.list?.marker),
    ["1", "2"]
  );
  assert.equal(
    new Set(after.lines.map((line) => line.list?.listId)).size,
    1,
    "both lines are in one list"
  );
});

test("a selection ending at the start of a line does not include that line", async () => {
  // Dragging to the beginning of the next line is not a request to make it an
  // item, and treating it as one is noticed immediately.
  const created = await create(scope, "one\ntwo");
  const v1 = await display(scope, created.contentId);

  await setList(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: {
      start: { segmentId: v1.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: v1.lines[1]!.segments[0]!.id, offset: 0 }
    },
    presentation: UNORDERED
  });

  const after = await display(scope, created.contentId);
  assert.equal(after.lines[0]!.list?.marker, "•");
  assert.equal(after.lines[1]!.list, undefined);
});

test("refuses a presentation whose marker or separator holds a line break", async () => {
  const created = await create(scope, "alpha");
  const v1 = await display(scope, created.contentId);
  const range = wholeLine(v1);

  const rejected: ListPresentation[] = [
    { kind: "unordered", marker: "•\n", separator: " " },
    { kind: "unordered", marker: "", separator: " " },
    { kind: "unordered", marker: "•", separator: "\n" },
    { kind: "ordered", start: 1.5, separator: ". " }
  ];

  for (const presentation of rejected) {
    await assert.rejects(
      () =>
        setList(scope, {
          contentId: created.contentId,
          expectedVersion: v1.version,
          range,
          presentation
        }),
      invalidPresentation
    );
  }
});
