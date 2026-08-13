import assert from "node:assert/strict";
import { test } from "node:test";
import { RichContentError } from "#rich-content/errors.js";
import { fixture } from "#rich-content/test/fixture.js";

test("combines independent content objects into one list without losing inline marks", async (context) => {
  const { runtime } = await fixture(context);
  const alpha = await runtime.create("alpha");
  const beta = await runtime.create("beta");
  const gamma = await runtime.create("gamma");

  const betaDisplay = await runtime.display(beta.contentId);
  const betaSegment = betaDisplay.lines[0]!.segments[0]!;
  const styledBeta = await runtime.applyStyle({
    contentId: beta.contentId,
    expectedVersion: beta.version,
    range: {
      start: { segmentId: betaSegment.id, offset: 0 },
      end: { segmentId: betaSegment.id, offset: betaSegment.text.length }
    },
    properties: { italic: true }
  });
  const gammaDisplay = await runtime.display(gamma.contentId);
  const gammaSegment = gammaDisplay.lines[0]!.segments[0]!;
  const linkedGamma = await runtime.setLink({
    contentId: gamma.contentId,
    expectedVersion: gamma.version,
    range: {
      start: { segmentId: gammaSegment.id, offset: 0 },
      end: { segmentId: gammaSegment.id, offset: gammaSegment.text.length }
    },
    targets: [{ kind: "resource", resourceKind: "document", resourceId: "doc-1" }]
  });

  const combined = await runtime.combineAsList({
    items: [
      { contentId: alpha.contentId, expectedVersion: alpha.version },
      { contentId: beta.contentId, expectedVersion: styledBeta.version },
      { contentId: gamma.contentId, expectedVersion: linkedGamma.version }
    ],
    presentation: { kind: "unordered", marker: "→", separator: " " }
  });

  assert.deepEqual(combined, { contentId: "content-4", version: 1 });
  for (const consumed of [alpha, beta, gamma]) {
    await assert.rejects(
      runtime.display(consumed.contentId),
      (error: unknown) =>
        error instanceof RichContentError && error.code === "content-not-found"
    );
  }

  const display = await runtime.display(combined.contentId);
  assert.deepEqual(
    display.lines.map((line) => line.segments.map(({ text }) => text).join("")),
    ["alpha", "beta", "gamma"]
  );
  assert.deepEqual(
    display.lines.map(({ list }) => list && `${list.marker}${list.separator}`),
    ["→ ", "→ ", "→ "]
  );
  assert.equal(display.lines[1]!.segments[0]!.style.italic, true);
  assert.equal(display.lines[2]!.segments[0]!.links[0]?.kind, "resource");
});

test("requires each combined list source to represent one logical line", async (context) => {
  const { runtime } = await fixture(context);
  const multiline = await runtime.create("first\nsecond");

  await assert.rejects(
    runtime.combineAsList({
      items: [
        { contentId: multiline.contentId, expectedVersion: multiline.version }
      ],
      presentation: { kind: "unordered", marker: "•", separator: " " }
    }),
    (error: unknown) =>
      error instanceof RichContentError && error.code === "invalid-list-source"
  );
  assert.ok(await runtime.display(multiline.contentId));
});
