import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

test("sets links while preserving surrounding text", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello world");
  const initial = await runtime.display(created.contentId);
  const segment = initial.lines[0]!.segments[0]!;

  await runtime.setLink({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: segment.id, offset: 6 },
      end: { segmentId: segment.id, offset: 11 }
    },
    targets: [
      { kind: "url", href: "https://example.com" },
      { kind: "resource", resourceKind: "document", resourceId: "doc-1" }
    ]
  });

  const display = await runtime.display(created.contentId);
  assert.deepEqual(display.lines[0]!.segments.map(({ text }) => text), ["hello ", "world"]);
  assert.equal(display.lines[0]!.segments[0]!.links.length, 0);
  assert.equal(display.lines[0]!.segments[1]!.links.length, 2);
});
