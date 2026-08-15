import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { split } from "$rich-content/api/split/split";
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

const at = (content: Awaited<ReturnType<typeof display>>, offset: number) => ({
  segmentId: content.lines[0]!.segments[0]!.id,
  offset
});

test("one object becomes two, and the source stops existing", async () => {
  // Identity is the point here, and it is a *relationship* rather than a
  // literal: three distinct ids, and the original resolves to nothing.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const result = await split(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    at: at(v1, 3)
  });

  assert.notEqual(result.left.contentId, result.right.contentId);
  assert.notEqual(result.left.contentId, created.contentId);
  assert.notEqual(result.right.contentId, created.contentId);

  assert.deepEqual(linesOf(await display(scope, result.left.contentId)), ["abc"]);
  assert.deepEqual(linesOf(await display(scope, result.right.contentId)), ["def"]);

  await assert.rejects(
    () => display(scope, created.contentId),
    (error: unknown) => error instanceof RichContentError && error.code === "content-not-found"
  );
});

test("both results start at version 1", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const result = await split(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    at: at(v1, 3)
  });

  assert.equal(result.left.version, 1);
  assert.equal(result.right.version, 1);
});

test("a mark straddling the split survives on both sides", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const styled = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 1, 5),
    properties: { bold: true }
  });
  const v2 = await display(scope, created.contentId);

  const result = await split(scope, {
    contentId: created.contentId,
    expectedVersion: styled.version,
    at: { segmentId: v2.lines[0]!.segments[1]!.id, offset: 2 }
  });

  const left = await display(scope, result.left.contentId);
  const right = await display(scope, result.right.contentId);

  assert.ok(
    left.lines[0]!.segments.some(({ style }) => style.bold),
    "the left half kept its bold"
  );
  assert.ok(
    right.lines[0]!.segments.some(({ style }) => style.bold),
    "the right half kept its bold"
  );
});

test("splitting at a line boundary consumes the break", async () => {
  const created = await create(scope, "first\nsecond");
  const v1 = await display(scope, created.contentId);

  const result = await split(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    at: { segmentId: v1.lines[1]!.segments[0]!.id, offset: 0 }
  });

  // One line each, rather than one of them carrying a stray empty line.
  assert.deepEqual(linesOf(await display(scope, result.left.contentId)), ["first"]);
  assert.deepEqual(linesOf(await display(scope, result.right.contentId)), ["second"]);
});

test("a stale expected version leaves the source untouched", async () => {
  // The transaction's rollback path: nothing is created and nothing is deleted.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await assert.rejects(
    () =>
      split(scope, {
        contentId: created.contentId,
        expectedVersion: v1.version + 5,
        at: at(v1, 3)
      }),
    (error: unknown) => error instanceof RichContentError && error.code === "stale-version"
  );

  assert.deepEqual(linesOf(await display(scope, created.contentId)), ["abcdef"]);
});
