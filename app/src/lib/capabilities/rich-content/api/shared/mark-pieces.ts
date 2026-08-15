import { markId } from "$rich-content/api/shared/ids";
import { comparePositions } from "$rich-content/api/shared/ranges";
import type { LinkMark, RawContent, RawRange, StyleMark } from "$rich-content/types/raw-content";

/**
 * The two halves a mark leaves behind when a range is cut out of its middle.
 *
 * Both are needed by style removal and by link removal, which is why they are
 * here rather than in either. Each piece gets a **new id**: it is a different
 * mark covering a different range, and reusing the id would make two marks
 * indistinguishable in a stored row.
 *
 * A piece is emitted only when it is non-empty, so a cut flush against either
 * end produces one piece rather than one and a zero-width ghost.
 */
type SplittableMark = StyleMark | LinkMark;

export const markBefore = <T extends SplittableMark>(
  content: RawContent,
  mark: T,
  removed: RawRange
): T[] =>
  comparePositions(content, mark.range.start, removed.start) < 0
    ? [{ ...mark, id: markId(), range: { start: mark.range.start, end: removed.start } }]
    : [];

export const markAfter = <T extends SplittableMark>(
  content: RawContent,
  mark: T,
  removed: RawRange
): T[] =>
  comparePositions(content, removed.end, mark.range.end) < 0
    ? [{ ...mark, id: markId(), range: { start: removed.end, end: mark.range.end } }]
    : [];
