import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

/**
 * List membership is a mark over a range of atoms, not text: the marker and its
 * separator are display chrome derived from the mark. Removing a list therefore
 * has to leave every character untouched — that is what distinguishes it from a
 * deletion, and it is the property worth asserting.
 */
test("removes list presentation without touching the text", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("alpha\nbeta\ngamma");
  const before = await runtime.display(created.contentId);
  const wholeRange = (content: typeof before) => {
    const first = content.lines[0]!.segments[0]!;
    const last = content.lines[2]!.segments[0]!;
    return {
      start: { segmentId: first.id, offset: 0 },
      end: { segmentId: last.id, offset: last.text.length }
    };
  };
  const text = (content: typeof before) =>
    content.lines.map((line) => line.segments.map(({ text }) => text).join(""));

  const listed = await runtime.setList({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: wholeRange(before),
    presentation: { kind: "ordered", start: 1, separator: ". " }
  });
  const withList = await runtime.display(created.contentId);
  assert.deepEqual(
    withList.lines.map(({ list }) => list && `${list.marker}${list.separator}`),
    ["1. ", "2. ", "3. "]
  );

  const removed = await runtime.removeList({
    contentId: created.contentId,
    expectedVersion: listed.version,
    range: wholeRange(withList)
  });
  const after = await runtime.display(created.contentId);

  assert.deepEqual(after.lines.map(({ list }) => list), [undefined, undefined, undefined]);
  assert.deepEqual(text(after), text(before));
  assert.equal(removed.version, listed.version + 1);
});

test("removes list presentation from only the selected lines", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("alpha\nbeta\ngamma");
  const before = await runtime.display(created.contentId);

  const listed = await runtime.setList({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: before.lines[0]!.segments[0]!.id, offset: 0 },
      end: {
        segmentId: before.lines[2]!.segments[0]!.id,
        offset: before.lines[2]!.segments[0]!.text.length
      }
    },
    presentation: { kind: "unordered", marker: "-", separator: " " }
  });

  // Selecting one line must leave its neighbours listed; the mark is per line,
  // so a range that touches only the middle line may not disturb the others.
  const withList = await runtime.display(created.contentId);
  const middle = withList.lines[1]!.segments[0]!;
  await runtime.removeList({
    contentId: created.contentId,
    expectedVersion: listed.version,
    range: {
      start: { segmentId: middle.id, offset: 0 },
      end: { segmentId: middle.id, offset: middle.text.length }
    }
  });

  assert.deepEqual(
    (await runtime.display(created.contentId)).lines.map(({ list }) => list?.marker),
    ["-", undefined, "-"]
  );
});
