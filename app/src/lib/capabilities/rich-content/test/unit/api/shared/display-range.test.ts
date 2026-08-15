import assert from "node:assert/strict";
import { test } from "vitest";
import {
  requireNonEmptyRange,
  resolveDisplayPosition,
  resolveDisplayRange,
  resolveSelectedLines
} from "$rich-content/api/shared/display-range";
import { renderDisplayContent } from "$rich-content/api/shared/render-display";
import { RichContentError } from "$rich-content/errors";
import type { RawContent } from "$rich-content/types/raw-content";

/**
 * Tier one, and the checks that matter most in the capability: every position a
 * browser sends comes through `display-range`.
 */
const invalidRange = (error: unknown): boolean =>
  error instanceof RichContentError && error.code === "invalid-display-range";

const content = (over: Partial<RawContent> = {}): RawContent => ({
  id: "content_1",
  version: 1,
  atoms: [{ id: "atom_1", kind: "text", text: "abcdef" }],
  marks: [],
  ...over
});

const segmentIdOf = (raw: RawContent, line = 0, segment = 0): string =>
  renderDisplayContent(raw).lines[line]!.segments[segment]!.id;

test("resolves a display position to the atom and offset behind it", () => {
  const raw = content();

  const position = resolveDisplayPosition(raw, { segmentId: segmentIdOf(raw), offset: 3 });

  assert.deepEqual(position, { atomId: "atom_1", offset: 3 });
});

test("a segment id from another revision is refused", () => {
  // Stale and invented get the same answer, because segment ids embed the
  // version they were rendered at.
  const raw = content();
  const stale = segmentIdOf(content({ version: 99 }));

  assert.throws(
    () => resolveDisplayPosition(raw, { segmentId: stale, offset: 0 }),
    invalidRange
  );
});

test("an invented segment id is refused", () => {
  assert.throws(
    () => resolveDisplayPosition(content(), { segmentId: "nonsense", offset: 0 }),
    invalidRange
  );
});

test("an offset past the end, negative, or non-integer is refused", () => {
  const raw = content();
  const segmentId = segmentIdOf(raw);

  for (const offset of [7, -1, 1.5, Number.NaN]) {
    assert.throws(() => resolveDisplayPosition(raw, { segmentId, offset }), invalidRange);
  }
});

test("an offset splitting a surrogate pair is refused", () => {
  // Editing between the halves of an astral character produces a lone surrogate.
  const raw = content({ atoms: [{ id: "atom_1", kind: "text", text: "a😀b" }] });
  const segmentId = segmentIdOf(raw);

  assert.throws(() => resolveDisplayPosition(raw, { segmentId, offset: 2 }), invalidRange);
  // Either side of the pair is fine.
  assert.doesNotThrow(() => resolveDisplayPosition(raw, { segmentId, offset: 1 }));
  assert.doesNotThrow(() => resolveDisplayPosition(raw, { segmentId, offset: 3 }));
});

test("a reversed range is refused rather than normalized", () => {
  // A caller sending end before start has a bug, and swapping them would hide it
  // and edit somewhere plausible.
  const raw = content();
  const segmentId = segmentIdOf(raw);

  assert.throws(
    () =>
      resolveDisplayRange(raw, {
        start: { segmentId, offset: 4 },
        end: { segmentId, offset: 2 }
      }),
    invalidRange
  );
});

test("an empty range is refused where a mutation needs one", () => {
  const raw = content();
  const segmentId = segmentIdOf(raw);
  const resolved = resolveDisplayRange(raw, {
    start: { segmentId, offset: 2 },
    end: { segmentId, offset: 2 }
  });

  assert.throws(() => requireNonEmptyRange(raw, resolved), invalidRange);
});

test("a selection ending at the start of a line does not include that line", () => {
  const raw = content({
    atoms: [
      { id: "atom_1", kind: "text", text: "one" },
      { id: "atom_2", kind: "line-break" },
      { id: "atom_3", kind: "text", text: "two" }
    ]
  });

  const lines = resolveSelectedLines(raw, {
    start: { segmentId: segmentIdOf(raw, 0), offset: 0 },
    end: { segmentId: segmentIdOf(raw, 1), offset: 0 }
  });

  assert.deepEqual(
    lines.map(({ index }) => index),
    [0]
  );
});

test("a selection reaching into a line includes it", () => {
  const raw = content({
    atoms: [
      { id: "atom_1", kind: "text", text: "one" },
      { id: "atom_2", kind: "line-break" },
      { id: "atom_3", kind: "text", text: "two" }
    ]
  });

  const lines = resolveSelectedLines(raw, {
    start: { segmentId: segmentIdOf(raw, 0), offset: 0 },
    end: { segmentId: segmentIdOf(raw, 1), offset: 1 }
  });

  assert.deepEqual(
    lines.map(({ index }) => index),
    [0, 1]
  );
});
