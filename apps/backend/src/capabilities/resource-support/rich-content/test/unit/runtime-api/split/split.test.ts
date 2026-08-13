import assert from "node:assert/strict";
import { test } from "node:test";
import { RichContentError } from "#rich-content/errors.js";
import { fixture } from "#rich-content/test/fixture.js";

test("splits one content object into two new objects and preserves inline marks", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello world");
  const initial = await runtime.display(created.contentId);
  const initialSegment = initial.lines[0]!.segments[0]!;

  const styled = await runtime.applyStyle({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: initialSegment.id, offset: 0 },
      end: { segmentId: initialSegment.id, offset: initialSegment.text.length }
    },
    properties: { bold: true }
  });
  const styledDisplay = await runtime.display(created.contentId);
  const styledSegment = styledDisplay.lines[0]!.segments[0]!;
  const linked = await runtime.setLink({
    contentId: created.contentId,
    expectedVersion: styled.version,
    range: {
      start: { segmentId: styledSegment.id, offset: 6 },
      end: { segmentId: styledSegment.id, offset: 11 }
    },
    targets: [{ kind: "url", href: "https://example.com/world" }]
  });
  const beforeSplit = await runtime.display(created.contentId);
  const world = beforeSplit.lines[0]!.segments[1]!;

  const split = await runtime.split({
    contentId: created.contentId,
    expectedVersion: linked.version,
    at: { segmentId: world.id, offset: 0 }
  });

  assert.deepEqual(split, {
    left: { contentId: "content-2", version: 1 },
    right: { contentId: "content-3", version: 1 }
  });
  await assert.rejects(
    runtime.display(created.contentId),
    (error: unknown) =>
      error instanceof RichContentError && error.code === "content-not-found"
  );

  const left = await runtime.display(split.left.contentId);
  const right = await runtime.display(split.right.contentId);
  assert.equal(left.lines[0]!.segments[0]!.text, "hello ");
  assert.equal(left.lines[0]!.segments[0]!.style.bold, true);
  assert.equal(right.lines[0]!.segments[0]!.text, "world");
  assert.equal(right.lines[0]!.segments[0]!.style.bold, true);
  assert.equal(right.lines[0]!.segments[0]!.links[0]?.kind, "url");
});

test("consumes the line break when splitting between existing lines", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("first\nsecond\nthird");
  const display = await runtime.display(created.contentId);
  const second = display.lines[1]!.segments[0]!;

  const split = await runtime.split({
    contentId: created.contentId,
    expectedVersion: created.version,
    at: { segmentId: second.id, offset: 0 }
  });
  const left = await runtime.display(split.left.contentId);
  const right = await runtime.display(split.right.contentId);

  assert.deepEqual(
    left.lines.map((line) => line.segments.map(({ text }) => text).join("")),
    ["first"]
  );
  assert.deepEqual(
    right.lines.map((line) => line.segments.map(({ text }) => text).join("")),
    ["second", "third"]
  );
});
