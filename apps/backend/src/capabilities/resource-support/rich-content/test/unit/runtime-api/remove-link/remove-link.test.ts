import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

test("removes links from a display selection", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello world");
  const initial = await runtime.display(created.contentId);
  const segment = initial.lines[0]!.segments[0]!;

  const linked = await runtime.setLink({
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

  const linkedSegment = display.lines[0]!.segments[1]!;
  await runtime.removeLink({
    contentId: created.contentId,
    expectedVersion: linked.version,
    range: {
      start: { segmentId: linkedSegment.id, offset: 0 },
      end: { segmentId: linkedSegment.id, offset: linkedSegment.text.length }
    }
  });
  assert.equal((await runtime.display(created.contentId)).lines[0]!.segments[0]!.links.length, 0);
});
