import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { replaceText } from "$rich-content/api/replace-text/replace-text";
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

const staleVersion = (error: unknown): boolean =>
  error instanceof RichContentError && error.code === "stale-version";

/**
 * The revision discipline, exercised through the functions that use it. This
 * replaces the backend's `persistence/store.test.ts`, which tested a class that
 * no longer exists.
 */
test("a mutation advances the revision by exactly one", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const result = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 2),
    properties: { bold: true }
  });

  assert.equal(result.version, v1.version + 1);
});

test("an expected version behind the current one is refused", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 2),
    properties: { bold: true }
  });

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: v1.version,
        atomId: v1.lines[0]!.segments[0]!.atomId,
        range: { start: 0, end: 1 },
        text: "Z"
      }),
    staleVersion
  );
});

test("an expected version ahead of the current one is refused too", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: v1.version + 5,
        atomId: v1.lines[0]!.segments[0]!.atomId,
        range: { start: 0, end: 1 },
        text: "Z"
      }),
    staleVersion
  );
});

test("a refused mutation changes no row", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await assert.rejects(
    () =>
      replaceText(scope, {
        contentId: created.contentId,
        expectedVersion: v1.version + 5,
        atomId: v1.lines[0]!.segments[0]!.atomId,
        range: { start: 0, end: 1 },
        text: "Z"
      }),
    staleVersion
  );

  const after = await display(scope, created.contentId);
  assert.equal(after.version, v1.version);
  assert.deepEqual(linesOf(after), ["abcdef"]);
});

test("two writers at the same revision: one wins, one is told", async () => {
  // The reason compare-and-swap exists. Without it the second write would
  // overwrite the first and neither caller would learn anything.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const settled = await Promise.allSettled([
    applyStyle(scope, {
      contentId: created.contentId,
      expectedVersion: v1.version,
      range: withinFirstSegment(v1, 0, 2),
      properties: { bold: true }
    }),
    applyStyle(scope, {
      contentId: created.contentId,
      expectedVersion: v1.version,
      range: withinFirstSegment(v1, 2, 4),
      properties: { italic: true }
    })
  ]);

  const fulfilled = settled.filter((outcome) => outcome.status === "fulfilled");
  const refused = settled.filter(
    (outcome) => outcome.status === "rejected" && staleVersion(outcome.reason)
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(refused.length, 1);
  assert.equal((await display(scope, created.contentId)).version, v1.version + 1);
});

test("an unknown id is content-not-found rather than stale", async () => {
  await assert.rejects(
    () =>
      applyStyle(scope, {
        contentId: "content_nothing",
        expectedVersion: 1,
        range: { start: { segmentId: "x", offset: 0 }, end: { segmentId: "x", offset: 1 } },
        properties: { bold: true }
      }),
    (error: unknown) => error instanceof RichContentError && error.code === "content-not-found"
  );
});
