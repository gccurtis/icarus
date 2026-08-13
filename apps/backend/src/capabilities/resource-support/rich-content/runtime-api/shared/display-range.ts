/**
 * Translates a versioned display selection into a private raw range. This is
 * the only inbound crossing of the display boundary: a caller names segments
 * and offsets, never atoms.
 */
import { RichContentError } from "#rich-content/errors.js";
import type {
  DisplayContent,
  DisplayPosition,
  DisplayRange
} from "#rich-content/types/display-content.js";
import type {
  RawContent,
  RawLine,
  RawPosition,
  RawRange
} from "#rich-content/types/raw-content.js";
import { rawLines } from "#rich-content/runtime-api/shared/raw-lines.js";
import { comparePositions } from "#rich-content/runtime-api/shared/ranges.js";
import { renderDisplayContent } from "#rich-content/runtime-api/shared/render-display.js";

type DisplayEntry = {
  lineIndex: number;
  segment: DisplayContent["lines"][number]["segments"][number];
};

const splitsSurrogatePair = (text: string, offset: number): boolean => {
  if (offset <= 0 || offset >= text.length) return false;
  const previous = text.charCodeAt(offset - 1);
  const next = text.charCodeAt(offset);
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
};

const displayEntries = (content: RawContent): DisplayEntry[] =>
  renderDisplayContent(content).lines.flatMap((line, lineIndex) =>
    line.segments.map((segment) => ({ lineIndex, segment }))
  );

const resolvePosition = (
  entries: DisplayEntry[],
  position: DisplayPosition
): { index: number; lineIndex: number; offset: number; raw: RawPosition } => {
  const index = entries.findIndex(({ segment }) => segment.id === position.segmentId);
  const entry = entries[index];
  if (
    !entry ||
    !Number.isInteger(position.offset) ||
    position.offset < 0 ||
    position.offset > entry.segment.text.length
  ) {
    throw new RichContentError(
      "invalid-display-range",
      "Display position is invalid or stale"
    );
  }
  if (splitsSurrogatePair(entry.segment.text, position.offset)) {
    throw new RichContentError("invalid-display-range", "Display position splits a character");
  }
  return {
    index,
    lineIndex: entry.lineIndex,
    offset: position.offset,
    raw: {
      atomId: entry.segment.atomId,
      offset: entry.segment.atomRange.start + position.offset
    }
  };
};

export const resolveDisplayRange = (
  content: RawContent,
  range: DisplayRange
): RawRange => {
  const entries = displayEntries(content);
  const start = resolvePosition(entries, range.start);
  const end = resolvePosition(entries, range.end);
  const rawRange = { start: start.raw, end: end.raw };
  if (comparePositions(content, rawRange.start, rawRange.end) > 0) {
    throw new RichContentError("invalid-display-range", "Display range is reversed");
  }
  return rawRange;
};

export const resolveDisplayPosition = (
  content: RawContent,
  position: DisplayPosition
): RawPosition => resolvePosition(displayEntries(content), position).raw;

export const resolveSelectedLines = (
  content: RawContent,
  range: DisplayRange
): RawLine[] => {
  const entries = displayEntries(content);
  const start = resolvePosition(entries, range.start);
  const end = resolvePosition(entries, range.end);
  if (start.index > end.index || (start.index === end.index && start.offset > end.offset)) {
    throw new RichContentError("invalid-display-range", "Display range is reversed");
  }

  let endLine = end.lineIndex;
  if (endLine > start.lineIndex && end.offset === 0) endLine -= 1;
  return rawLines(content).slice(start.lineIndex, endLine + 1);
};

export const requireNonEmptyRange = (content: RawContent, range: RawRange): void => {
  if (comparePositions(content, range.start, range.end) === 0) {
    throw new RichContentError("invalid-display-range", "Mutation range cannot be empty");
  }
};
