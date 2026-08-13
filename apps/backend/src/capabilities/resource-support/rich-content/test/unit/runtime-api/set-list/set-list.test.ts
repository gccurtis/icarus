import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "#rich-content/test/fixture.js";

test("renders custom unordered and ordered list presentation", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("alpha\nbeta\ngamma");
  const before = await runtime.display(created.contentId);
  const first = before.lines[0]!.segments[0]!;
  const last = before.lines[2]!.segments[0]!;

  const unordered = await runtime.setList({
    contentId: created.contentId,
    expectedVersion: created.version,
    range: {
      start: { segmentId: first.id, offset: 0 },
      end: { segmentId: last.id, offset: last.text.length }
    },
    presentation: { kind: "unordered", marker: "→", separator: " :: " }
  });
  const displayed = await runtime.display(created.contentId);
  assert.deepEqual(
    displayed.lines.map(({ list }) => list && `${list.marker}${list.separator}`),
    ["→ :: ", "→ :: ", "→ :: "]
  );

  const firstCurrent = displayed.lines[0]!.segments[0]!;
  const lastCurrent = displayed.lines[2]!.segments[0]!;
  await runtime.setList({
    contentId: created.contentId,
    expectedVersion: unordered.version,
    range: {
      start: { segmentId: firstCurrent.id, offset: 0 },
      end: { segmentId: lastCurrent.id, offset: lastCurrent.text.length }
    },
    presentation: { kind: "ordered", start: 3, separator: ") " }
  });
  assert.deepEqual(
    (await runtime.display(created.contentId)).lines.map(({ list }) =>
      list && `${list.marker}${list.separator}`
    ),
    ["3) ", "4) ", "5) "]
  );
});
