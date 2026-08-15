import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { applyStyle } from "$rich-content/api/apply-style/apply-style";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { setLink } from "$rich-content/api/set-link/set-link";
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

test("an unknown id is content-not-found", async () => {
  await assert.rejects(
    () => display(scope, "content_nothing"),
    (error: unknown) => error instanceof RichContentError && error.code === "content-not-found"
  );
});

test("every style property is resolved, so a renderer never sees an absent one", async () => {
  const created = await create(scope, "plain");

  const [segment] = (await display(scope, created.contentId)).lines[0]!.segments;

  assert.equal(segment?.style.bold, false);
  assert.equal(segment?.style.fontWeight, 400);
  assert.equal(segment?.style.color, "inherit");
});

test("segments are cut where formatting changes, and their style is uniform", async () => {
  const created = await create(scope, "abcdef");
  const first = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: first.version,
    range: withinFirstSegment(first, 2, 4),
    properties: { bold: true }
  });

  const after = await display(scope, created.contentId);
  const segments = after.lines[0]!.segments;

  assert.deepEqual(
    segments.map(({ text }) => text),
    ["ab", "cd", "ef"]
  );
  assert.deepEqual(
    segments.map(({ style }) => style.bold),
    [false, true, false]
  );
  // The text a reader sees is unchanged by how many pieces it is in.
  assert.deepEqual(linesOf(after), ["abcdef"]);
});

test("overlapping marks cross without either being split in storage", async () => {
  // The property atoms-and-marks exists for: a bold span and a link span
  // partially overlapping produce three segments, not two conflicting marks.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const styled = await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 4),
    properties: { bold: true }
  });

  const v2 = await display(scope, created.contentId);
  await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: styled.version,
    range: { start: { segmentId: v2.lines[0]!.segments[1]!.id, offset: 0 }, end: { segmentId: v2.lines[0]!.segments[1]!.id, offset: 2 } },
    targets: [{ kind: "url", href: "https://example.test" }]
  });

  const after = await display(scope, created.contentId);
  const bold = after.lines[0]!.segments.filter(({ style }) => style.bold);
  const linked = after.lines[0]!.segments.filter(({ links }) => links.length > 0);

  assert.ok(bold.length > 0, "the bold span survived");
  assert.ok(linked.length > 0, "the link span survived");
  assert.deepEqual(linesOf(after), ["abcdef"]);
});

test("segment ids change with the version, which is what makes a handle stale", async () => {
  const created = await create(scope, "abcdef");
  const before = await display(scope, created.contentId);

  await applyStyle(scope, {
    contentId: created.contentId,
    expectedVersion: before.version,
    range: withinFirstSegment(before, 0, 2),
    properties: { bold: true }
  });

  const after = await display(scope, created.contentId);

  assert.notEqual(after.version, before.version);
  assert.equal(
    after.lines[0]!.segments.filter(({ id }) =>
      before.lines[0]!.segments.some((old) => old.id === id)
    ).length,
    0
  );
});
