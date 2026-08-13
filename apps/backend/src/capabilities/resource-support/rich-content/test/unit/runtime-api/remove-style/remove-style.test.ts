import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

test("removes only the requested style properties", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello world");
  const initial = await runtime.display(created.contentId);
  const segment = initial.lines[0]!.segments[0]!;

  const styled = await runtime.applyStyle({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: segment.id, offset: 0 },
      end: { segmentId: segment.id, offset: 5 }
    },
    properties: { bold: true, color: "red" }
  });
  const display = await runtime.display(created.contentId);

  const styledSegment = display.lines[0]!.segments[0]!;
  await runtime.removeStyle({
    contentId: created.contentId,
    expectedVersion: styled.version,
    range: {
      start: { segmentId: styledSegment.id, offset: 0 },
      end: { segmentId: styledSegment.id, offset: styledSegment.text.length }
    },
    properties: ["bold"]
  });
  const removed = await runtime.display(created.contentId);
  assert.equal(removed.lines[0]!.segments[0]!.style.bold, false);
  assert.equal(removed.lines[0]!.segments[0]!.style.color, "red");
});
