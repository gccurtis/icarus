import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { RichContentError } from "$rich-content/errors";
import { installDatabases, scopeFor, withinFirstSegment } from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const invalidStyle = (error: unknown): boolean =>
  error instanceof RichContentError && error.code === "invalid-style";

const styledText = (
  projection: Awaited<ReturnType<typeof display>>,
  predicate: (style: { bold: boolean; italic: boolean }) => boolean
): string =>
  projection.lines[0]!.segments.filter(({ style }) => predicate(style)).map(({ text }) => text).join("");

test("applies a property across the selection and nowhere else", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 2, 4),
    properties: { bold: true }
  });

  assert.equal(styledText(await display(scope, created.contentId), (s) => s.bold), "cd");
});

test("styles layer, and a later one wins where they overlap", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const first = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 6),
    properties: { bold: true, fontSize: 1 }
  });
  const v2 = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: first.version,
    range: {
      start: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 3 }
    },
    properties: { fontSize: 2 }
  });

  const after = await display(scope, created.contentId);
  const sizes = after.lines[0]!.segments.map(({ text, style }) => [text, style.fontSize]);

  assert.deepEqual(sizes, [
    ["abc", 2],
    ["def", 1]
  ]);
  // The earlier bold is still in force underneath the newer size.
  assert.equal(styledText(after, (s) => s.bold), "abcdef");
});

test("an undefined property is dropped rather than stored", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3),
    properties: { bold: true, italic: undefined }
  });

  const after = await display(scope, created.contentId);
  assert.equal(styledText(after, (s) => s.italic), "");
});

test("refuses an empty, unknown, or wrongly-typed property set", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const range = withinFirstSegment(v1, 0, 3);

  for (const properties of [
    {},
    { italic: undefined },
    { nonsense: true } as unknown as { bold: boolean },
    { bold: "yes" } as unknown as { bold: boolean },
    { fontSize: Number.NaN }
  ]) {
    await assert.rejects(
      () =>
        applyStyle(scope, {
          contentId: created.contentId,
          expectedVersion: v1.version,
          range,
          properties
        }),
      invalidStyle
    );
  }
});

test("refuses an empty range", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await assert.rejects(
    () =>
      applyStyle(scope, {
        contentId: created.contentId,
        expectedVersion: v1.version,
        range: withinFirstSegment(v1, 2, 2),
        properties: { bold: true }
      }),
    (error: unknown) =>
      error instanceof RichContentError && error.code === "invalid-display-range"
  );
});

test("refuses a stale segment handle", async () => {
  // The property versioned handles exist for: a selection from an earlier
  // revision names segments the current projection does not have.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const staleRange = withinFirstSegment(v1, 0, 2);

  const applied = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: staleRange,
    properties: { bold: true }
  });

  await assert.rejects(
    () =>
      applyStyle(scope, {
        contentId: created.contentId,
        expectedVersion: applied.version,
        range: staleRange,
        properties: { italic: true }
      }),
    (error: unknown) =>
      error instanceof RichContentError && error.code === "invalid-display-range"
  );
});
