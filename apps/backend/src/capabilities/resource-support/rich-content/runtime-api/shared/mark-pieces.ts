import type {
  LinkMark,
  RawContent,
  RawRange,
  StyleMark
} from "#rich-content/types/raw-content.js";
import { comparePositions } from "#rich-content/runtime-api/shared/ranges.js";

type SplittableMark = StyleMark | LinkMark;

export const markBefore = <T extends SplittableMark>(
  content: RawContent,
  mark: T,
  removed: RawRange,
  nextId: () => string
): T[] =>
  comparePositions(content, mark.range.start, removed.start) < 0
    ? [{ ...mark, id: nextId(), range: { start: mark.range.start, end: removed.start } }]
    : [];

export const markAfter = <T extends SplittableMark>(
  content: RawContent,
  mark: T,
  removed: RawRange,
  nextId: () => string
): T[] =>
  comparePositions(content, removed.end, mark.range.end) < 0
    ? [{ ...mark, id: nextId(), range: { start: removed.end, end: mark.range.end } }]
    : [];
