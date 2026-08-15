import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { create } from "$rich-content/api/create/create";
import { display } from "$rich-content/api/display/display";
import { setLink } from "$rich-content/api/set-link/set-link";
import { RichContentError } from "$rich-content/errors";
import { installDatabases, scopeFor, withinFirstSegment } from "$rich-content/test/fixture";
import type { LinkTarget } from "$rich-content/types/formatting";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$rich-content/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const invalidLink = (error: unknown): boolean =>
  error instanceof RichContentError && error.code === "invalid-link";

const linkedText = (projection: Awaited<ReturnType<typeof display>>): string =>
  projection.lines[0]!.segments.filter(({ links }) => links.length > 0).map(({ text }) => text).join("");

test("links a selection to a URL", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3),
    targets: [{ kind: "url", href: "https://example.test" }]
  });

  const after = await display(scope, created.contentId);
  assert.equal(linkedText(after), "abc");
  assert.deepEqual(after.lines[0]!.segments[0]!.links, [
    { kind: "url", href: "https://example.test" }
  ]);
});

test("a resource target keeps the reference rather than a rendered href", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3),
    targets: [{ kind: "resource", resourceKind: "document", resourceId: "doc-1" }]
  });

  assert.deepEqual((await display(scope, created.contentId)).lines[0]!.segments[0]!.links, [
    { kind: "resource", resourceKind: "document", resourceId: "doc-1" }
  ]);
});

test("setting a link replaces one already covering the range", async () => {
  // Links do not layer: text pointing at two places at once is not something a
  // reader can act on.
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);

  const first = await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 6),
    targets: [{ kind: "url", href: "https://first.test" }]
  });
  const v2 = await display(scope, created.contentId);

  await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: first.version,
    range: {
      start: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 0 },
      end: { segmentId: v2.lines[0]!.segments[0]!.id, offset: 6 }
    },
    targets: [{ kind: "url", href: "https://second.test" }]
  });

  assert.deepEqual((await display(scope, created.contentId)).lines[0]!.segments[0]!.links, [
    { kind: "url", href: "https://second.test" }
  ]);
});

test("targets are copied, so a caller cannot change a stored mark", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const targets: LinkTarget[] = [{ kind: "url", href: "https://example.test" }];

  await setLink(scope, {
    contentId: created.contentId,
    expectedVersion: v1.version,
    range: withinFirstSegment(v1, 0, 3),
    targets
  });

  (targets[0] as { href: string }).href = "https://evil.test";

  assert.deepEqual((await display(scope, created.contentId)).lines[0]!.segments[0]!.links, [
    { kind: "url", href: "https://example.test" }
  ]);
});

test("refuses no targets, an empty href, or an incomplete resource target", async () => {
  const created = await create(scope, "abcdef");
  const v1 = await display(scope, created.contentId);
  const range = withinFirstSegment(v1, 0, 3);

  const rejected: LinkTarget[][] = [
    [],
    [{ kind: "url", href: "" }],
    [{ kind: "resource", resourceKind: "", resourceId: "doc-1" }],
    [{ kind: "resource", resourceKind: "document", resourceId: "" }]
  ];

  for (const targets of rejected) {
    await assert.rejects(
      () =>
        setLink(scope, {
          contentId: created.contentId,
          expectedVersion: v1.version,
          range,
          targets
        }),
      invalidLink
    );
  }
});
