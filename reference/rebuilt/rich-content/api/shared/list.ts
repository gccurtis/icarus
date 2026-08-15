import { RichContentError } from "$rich-content/errors";
import { listId as newListId, markId } from "$rich-content/api/shared/ids";
import { lineRange, listMarkForLine, rawLines } from "$rich-content/api/shared/raw-lines";
import type { ListPresentation } from "$rich-content/types/formatting";
import type {
  ListItemMark,
  RawContent,
  RawLine,
  RawMark
} from "$rich-content/types/raw-content";

const samePresentation = (left: ListPresentation, right: ListPresentation): boolean =>
  left.kind === right.kind &&
  left.separator === right.separator &&
  (left.kind === "unordered" && right.kind === "unordered"
    ? left.marker === right.marker
    : left.kind === "ordered" && right.kind === "ordered" && left.start === right.start);

/**
 * Copies a presentation field by field, dropping anything else a payload
 * carried, so nothing unvalidated reaches a stored mark.
 */
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

/**
 * A marker or separator containing a line break is refused, because a line break
 * is an *atom* here — one appearing in a rendered marker would put a line
 * boundary somewhere the atom sequence says there is none, and every range
 * computed afterwards would disagree with what a reader sees.
 */
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

/**
 * Marks the selected lines as list items, joining a neighbouring list where one
 * matches.
 *
 * The join is what makes numbering behave. Applying an ordered list to a line
 * directly below an existing one continues that list's `listId`, so
 * `render-display` counts them as one sequence rather than restarting at the
 * start value — which is what someone extending a list expects and would
 * otherwise have to fix by hand.
 */
export const setListMarks = (
  content: RawContent,
  selected: readonly RawLine[],
  presentation: ListPresentation
): readonly RawMark[] => {
  const lines = rawLines(content);
  const selectedIndexes = new Set(selected.map(({ index }) => index));
  const neighboringMarks = [lines[selected[0]!.index - 1], lines[selected.at(-1)!.index + 1]]
    .filter((line): line is RawLine => line !== undefined)
    .map((line) => listMarkForLine(content, line))
    .filter(
      (mark): mark is ListItemMark =>
        mark !== undefined && samePresentation(mark.presentation, presentation)
    );
  const existing = selected
    .map((line) => listMarkForLine(content, line))
    .find((mark) => mark && samePresentation(mark.presentation, presentation));
  const listId = neighboringMarks[0]?.listId ?? existing?.listId ?? newListId();
  const retained = content.marks.filter((mark) => {
    if (mark.kind !== "list-item") return true;
    const line = lines.find((candidate) =>
      candidate.atoms.some(({ id }) => id === mark.range.start.atomId)
    );
    return !line || !selectedIndexes.has(line.index);
  });
  const added: ListItemMark[] = selected.map((line) => ({
    id: markId(),
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
