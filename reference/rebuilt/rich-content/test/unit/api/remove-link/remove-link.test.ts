import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { removeLink } from "$rich-content/api/remove-link/remove-link";
import { setLink } from "$rich-content/api/set-link/set-link";
import { installDatabases, linesOf, scopeFor, withinFirstSegment } from "$rich-content/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const linkedText = (projection: Awaited<ReturnType<typeof display>>): string =>
  projection.lines[0]!.segments.filter(({ links }) => links.length > 0).map(({ text }) => text).join("");

const linkedWhole = async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const linked = await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 6),
    targets: [{ kind: "url", href: "https://example.test" }]
  });
  return { contentId: created.contentId, version: linked.version };
};

test("removes a link across the whole selection", async () => {
  const { contentId, version } = await linkedWhole();
  const projection = await display(scope, contentId);

  await removeLink(scope, {
    contentId,
    expectedVersion: version,
    range: {
      start: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 6 }
    }
  });

  assert.equal(linkedText(await display(scope, contentId)), "");
});

test("unlinking the middle leaves both ends linked", async () => {
  const { contentId, version } = await linkedWhole();
  const projection = await display(scope, contentId);

  await removeLink(scope, {
    contentId,
    expectedVersion: version,
    range: {
      start: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 2 },
      end: { segmentId: projection.lines[0]!.segments[0]!.id, offset: 4 }
    }
  });

  const after = await display(scope, contentId);
  assert.equal(linkedText(after), "abef");
  assert.deepEqual(linesOf(after), ["abcdef"], "no text was harmed");
});

test("removing a link where there is none is not a failure", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const result = await removeLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3)
  });

  assert.equal(result.version, v1.version + 1);
  assert.equal(linkedText(await display(scope, created.contentId)), "");
});
