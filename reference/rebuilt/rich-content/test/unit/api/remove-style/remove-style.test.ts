import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { removeStyle } from "$rich-content/api/remove-style/remove-style";
import { RichContentError } from "$rich-content/errors";
import { installDatabases, scopeFor, withinFirstSegment } from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const boldText = (projection: Awaited<ReturnType<typeof display>>): string =>
  projection.lines[0]!.segments.filter(({ style }) => style.bold).map(({ text }) => text).join("");

const italicText = (projection: Awaited<ReturnType<typeof display>>): string =>
  projection.lines[0]!.segments.filter(({ style }) => style.italic).map(({ text }) => text).join("");

const boldAndItalic = async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const applied = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 6),
    properties: { bold: true, italic: true }
  });
  return { contentId: created.contentId, version: applied.version };
};

test("removes only the properties named", async () => {
  const { contentId, version } = await boldAndItalic();
  const projection = await display(scope, contentId);

  await removeStyle(scope, {
    contentId,
    expectedVersion: version,
    range: {
      start: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 6 }
    },
    properties: ["bold"]
  });

  const after = await display(scope, contentId);
  assert.equal(boldText(after), "", "bold is gone");
  assert.equal(italicText(after), "abcdef", "italic was not asked about and survived");
});

test("a style extending past the selection survives outside it", async () => {
  const { contentId, version } = await boldAndItalic();
  const projection = await display(scope, contentId);

  await removeStyle(scope, {
    contentId,
    expectedVersion: version,
    range: {
      start: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 2 },
      end: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 4 }
    },
    properties: ["bold"]
  });

  // The mark was split into the part before and the part after.
  assert.equal(boldText(await display(scope, contentId)), "abef");
});

test("removing the newer style reveals the older one underneath", async () => {
  // The reason applyStyle appends rather than merges.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const first = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 6),
    properties: { fontSize: 1 }
  });
  const v2 = await display(scope, created.contentId);
  const second = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: first.version,
    range: {
      start: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 6 }
    },
    properties: { fontSize: 3 }
  });

  const v3 = await display(scope, created.contentId);
  await removeStyle(scope, {
    contentId: created.contentId,
    expectedVersion: second.version,
    range: {
      start: { segmentId: v3.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: v3.lines[0]!.segments[0]!.id, offset: 6 }
    },
    properties: ["fontSize"]
  });

  // Not the default 1... the earlier mark also said 1, so this asserts the
  // earlier instruction is what remains rather than everything being cleared.
  assert.equal((await display(scope, created.contentId)).lines[0]!.segments[0]!.style.fontSize, 1);
});

test("refuses an empty or unknown property list", async () => {
  const { contentId, version } = await boldAndItalic();
  const projection = await display(scope, contentId);
  const range = {
    start: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 0 },
    end: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 6 }
  };

  // `"nonsense"` is not a style property, which is exactly what is being
  // checked — the cast is what lets a hostile payload be expressed here.
  for (const properties of [[], ["nonsense"]] as unknown as Array<Array<"bold">>) {
    await assert.rejects(
      () => removeStyle(scope, { contentId, expectedVersion: version, range, properties }),
      (error: unknown) => error instanceof RichContentError && error.code === "invalid-style"
    );
  }
});
