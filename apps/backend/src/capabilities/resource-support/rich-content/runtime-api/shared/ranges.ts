import { RichContentError } from "#rich-content/errors.js";
import type {
  RawContent,
  RawPosition,
  RawRange
} from "#rich-content/types/raw-content.js";

export interface NumericRange {
  readonly start: number;
  readonly end: number;
}

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

export const rangesOverlap = (
  content: RawContent,
  left: RawRange,
  right: RawRange
): boolean => {
  const a = numericRange(content, left);
  const b = numericRange(content, right);
  return a.start < b.end && b.start < a.end;
};

export const rangeContains = (
  content: RawContent,
  outer: RawRange,
  inner: RawRange
): boolean => {
  const a = numericRange(content, outer);
  const b = numericRange(content, inner);
  return a.start <= b.start && b.end <= a.end;
};

export const intersectRanges = (
  content: RawContent,
  left: RawRange,
  right: RawRange
): RawRange => ({
  start:
    comparePositions(content, left.start, right.start) >= 0
      ? left.start
      : right.start,
  end:
    comparePositions(content, left.end, right.end) <= 0 ? left.end : right.end
});
