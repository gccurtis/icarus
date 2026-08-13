import { RichContentError } from "#rich-content/errors.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { ListPresentation } from "#rich-content/types/formatting.js";
import type {
  ListItemMark,
  RawContent,
  RawLine,
  RawMark
} from "#rich-content/types/raw-content.js";
import {
  lineRange,
  listMarkForLine,
  rawLines
} from "#rich-content/runtime-api/shared/raw-lines.js";

const samePresentation = (left: ListPresentation, right: ListPresentation): boolean =>
  left.kind === right.kind &&
  left.separator === right.separator &&
  (left.kind === "unordered" && right.kind === "unordered"
    ? left.marker === right.marker
    : left.kind === "ordered" && right.kind === "ordered" && left.start === right.start);

export const copyListPresentation = (presentation: ListPresentation): ListPresentation =>
  presentation.kind === "unordered"
    ? {
        kind: "unordered",
        marker: presentation.marker,
        separator: presentation.separator
      }
    : {
        kind: "ordered",
        start: presentation.start,
        separator: presentation.separator
      };

export const validateListPresentation = (presentation: ListPresentation): void => {
  if (presentation.separator.includes("\n")) {
    throw new RichContentError(
      "invalid-list-presentation",
      "A list separator cannot contain a line break"
    );
  }
  if (presentation.kind === "unordered") {
    if (presentation.marker.length === 0 || presentation.marker.includes("\n")) {
      throw new RichContentError(
        "invalid-list-presentation",
        "An unordered list marker must be non-empty and cannot contain a line break"
      );
    }
    return;
  }
  if (!Number.isSafeInteger(presentation.start)) {
    throw new RichContentError(
      "invalid-list-presentation",
      "An ordered list start must be a safe integer"
    );
  }
};

export const setListMarks = (
  content: RawContent,
  selected: readonly RawLine[],
  presentation: ListPresentation,
  ids: RichContentIdFactory
): readonly RawMark[] => {
  const lines = rawLines(content);
  const selectedIndexes = new Set(selected.map(({ index }) => index));
  const neighboringMarks = [
    lines[selected[0]!.index - 1],
    lines[selected.at(-1)!.index + 1]
  ]
    .filter((line): line is RawLine => line !== undefined)
    .map((line) => listMarkForLine(content, line))
    .filter((mark): mark is ListItemMark =>
      mark !== undefined && samePresentation(mark.presentation, presentation)
    );
  const existing = selected
    .map((line) => listMarkForLine(content, line))
    .find((mark) => mark && samePresentation(mark.presentation, presentation));
  const listId = neighboringMarks[0]?.listId ?? existing?.listId ?? ids.listId();
  const retained = content.marks.filter((mark) => {
    if (mark.kind !== "list-item") return true;
    const line = lines.find((candidate) =>
      candidate.atoms.some(({ id }) => id === mark.range.start.atomId)
    );
    return !line || !selectedIndexes.has(line.index);
  });
  const added: ListItemMark[] = selected.map((line) => ({
    id: ids.markId(),
    kind: "list-item",
    range: lineRange(line),
    listId,
    presentation: copyListPresentation(presentation)
  }));
  return [...retained, ...added];
};

export const removeListMarks = (
  content: RawContent,
  selected: readonly RawLine[]
): readonly RawMark[] => {
  const lines = rawLines(content);
  const selectedIndexes = new Set(selected.map(({ index }) => index));
  return content.marks.filter((mark) => {
    if (mark.kind !== "list-item") return true;
    const line = lines.find((candidate) =>
      candidate.atoms.some(({ id }) => id === mark.range.start.atomId)
    );
    return !line || !selectedIndexes.has(line.index);
  });
};
