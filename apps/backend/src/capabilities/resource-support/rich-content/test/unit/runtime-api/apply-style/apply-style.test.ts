import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

test("applies style over a display selection", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello world");
  const initial = await runtime.display(created.contentId);
  const segment = initial.lines[0]!.segments[0]!;

  await runtime.applyStyle({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: segment.id, offset: 0 },
      end: { segmentId: segment.id, offset: 5 }
    },
    properties: { bold: true, color: "red" }
  });

  const display = await runtime.display(created.contentId);
  assert.deepEqual(display.lines[0]!.segments.map(({ text }) => text), ["hello", " world"]);
  assert.equal(display.lines[0]!.segments[0]!.style.bold, true);
  assert.equal(display.lines[0]!.segments[0]!.style.color, "red");
  assert.equal(display.lines[0]!.segments[1]!.style.bold, false);
});
