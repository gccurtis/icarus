import { RichContentError } from "$rich-content/errors";
import type { RawContent, RawPosition, RawRange } from "$rich-content/types/raw-content";

/**
 * Range arithmetic over raw positions.
 *
 * Every comparison goes through a flat character offset rather than comparing
 * atom ids and offsets directly, because two positions in different atoms have
 * no order until they are both resolved against the same atom sequence. Doing it
 * one way, here, is what keeps overlap and containment agreeing with each other.
 */
export interface NumericRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The flat offset of a raw position, and the validation that it exists.
 *
 * A position naming an atom the content does not have, or an offset past the end
 * of the one it does, is refused rather than clamped — a clamped position would
 * silently edit somewhere the caller did not point at.
 */
export const rawOffset = (content: RawContent, position: RawPosition): number => {
  let offset = 0;
  for (const atom of content.atoms) {
    if (atom.id === position.atomId) {
      if (
        atom.kind !== "text" ||
        !Number.isInteger(position.offset) ||
        position.offset < 0 ||
        position.offset > atom.text.length
      ) {
        throw new RichContentError("invalid-display-range", "Raw position is invalid");
      }
      return offset + position.offset;
    }
    // A line break occupies one position, so ranges spanning one stay contiguous.
    offset += atom.kind === "text" ? atom.text.length : 1;
  }
  throw new RichContentError("invalid-display-range", "Raw position atom was not found");
};

export const numericRange = (content: RawContent, range: RawRange): NumericRange => ({
  start: rawOffset(content, range.start),
  end: rawOffset(content, range.end)
});

export const comparePositions = (
  content: RawContent,
  left: RawPosition,
  right: RawPosition
): number => rawOffset(content, left) - rawOffset(content, right);

/** Half-open, so two ranges meeting end-to-start do not count as overlapping. */
export const rangesOverlap = (content: RawContent, left: RawRange, right: RawRange): boolean => {
  const a = numericRange(content, left);
  const b = numericRange(content, right);
  return a.start < b.end && b.start < a.end;
};

export const rangeContains = (content: RawContent, outer: RawRange, inner: RawRange): boolean => {
  const a = numericRange(content, outer);
  const b = numericRange(content, inner);
  return a.start <= b.start && b.end <= a.end;
};

export const intersectRanges = (
  content: RawContent,
  left: RawRange,
  right: RawRange
): RawRange => ({
  start: comparePositions(content, left.start, right.start) >= 0 ? left.start : right.start,
  end: comparePositions(content, left.end, right.end) <= 0 ? left.end : right.end
});
