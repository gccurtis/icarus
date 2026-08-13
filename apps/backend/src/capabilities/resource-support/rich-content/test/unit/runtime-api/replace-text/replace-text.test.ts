import assert from "node:assert/strict";
import { test } from "node:test";
import { RichContentError } from "#rich-content/errors.js";
import { fixture } from "#rich-content/test/fixture.js";

test("revision-gates canonical text replacement", async (context) => {
  const { runtime } = await fixture(context);
  const created = await runtime.create("hello");
  const before = await runtime.display(created.contentId);
  const atomId = before.lines[0]!.segments[0]!.atomId;

  const changed = await runtime.replaceText({
    contentId: created.contentId,
    expectedVersion: created.version,
    atomId,
    range: { start: 1, end: 4 },
    text: "i"
  });

  assert.equal(changed.version, 2);
  assert.equal((await runtime.display(created.contentId)).lines[0]?.segments[0]?.text, "hio");
  await assert.rejects(
    runtime.replaceText({
      contentId: created.contentId,
      expectedVersion: 1,
      atomId,
      range: { start: 0, end: 0 },
      text: "!"
    }),
    (error: unknown) =>
      error instanceof RichContentError && error.code === "stale-version"
  );
});
