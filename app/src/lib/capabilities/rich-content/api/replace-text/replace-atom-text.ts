import { RichContentError } from "$rich-content/errors";
import type { ReplaceTextInput } from "$rich-content/types/inputs";
import type {
  RawAtom,
  RawContent,
  RawMark,
  RawPosition,
  TextAtom
} from "$rich-content/types/raw-content";

export interface TextReplacement {
  readonly atoms: readonly RawAtom[];
  readonly marks: readonly RawMark[];
}

const splitsSurrogatePair = (text: string, offset: number): boolean => {
  if (offset <= 0 || offset >= text.length) return false;
  const previous = text.charCodeAt(offset - 1);
  const next = text.charCodeAt(offset);
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
};

const validateRange = (atom: TextAtom, input: ReplaceTextInput): void => {
  const { start, end } = input.range;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > atom.text.length ||
    splitsSurrogatePair(atom.text, start) ||
    splitsSurrogatePair(atom.text, end)
  ) {
    throw new RichContentError("invalid-atom-range", "The text range is invalid");
  }
};

/**
 * Moves every mark boundary the edit displaced.
 *
 * Three cases, and the middle one is the interesting one. A boundary before the
 * replaced span does not move; one after it shifts by the length difference; one
 * *inside* it collapses to an edge — start to the beginning of the replacement,
 * end to the end of it. Without that, a mark would keep pointing into text that
 * no longer exists.
 *
 * A list mark covering the whole atom is re-stretched instead, because it means
 * "this line" rather than a character range, and shrinking it to the old length
 * would leave the tail of an edited line outside its own list item.
 */
const transformMarks = (
  marks: readonly RawMark[],
  previous: TextAtom,
  next: TextAtom,
  replacedStart: number,
  replacedEnd: number,
  insertedLength: number
): readonly RawMark[] => {
  const delta = insertedLength - (replacedEnd - replacedStart);
  const transform = (position: RawPosition, edge: "start" | "end"): RawPosition => {
    if (position.atomId !== previous.id || position.offset <= replacedStart) return position;
    if (position.offset >= replacedEnd) {
      return { ...position, offset: position.offset + delta };
    }
    return {
      ...position,
      offset: edge === "start" ? replacedStart : replacedStart + insertedLength
    };
  };

  return marks.map((mark) => {
    if (
      mark.kind === "list-item" &&
      mark.range.start.atomId === next.id &&
      mark.range.end.atomId === next.id
    ) {
      return {
        ...mark,
        range: {
          start: { atomId: next.id, offset: 0 },
          end: { atomId: next.id, offset: next.text.length }
        }
      };
    }
    return {
      ...mark,
      range: {
        start: transform(mark.range.start, "start"),
        end: transform(mark.range.end, "end")
      }
    };
  });
};

/**
 * Rewrites one text atom and moves every mark boundary the edit displaced.
 *
 * **The atom keeps its id.** That is what lets a display handle for a
 * neighbouring atom stay meaningful across the edit, and what lets a list mark
 * keep covering its whole line.
 *
 * A line break in the replacement is refused rather than split into atoms. Doing
 * it properly means deciding what happens to every mark spanning the new
 * boundary, and refusing is honest about that not being settled yet.
 */
export const replaceAtomText = (
  content: RawContent,
  input: ReplaceTextInput
): TextReplacement => {
  if (input.text.includes("\n")) {
    throw new RichContentError(
      "unsupported-text",
      "Text replacement cannot contain a line break in this runtime increment"
    );
  }
  const atom = content.atoms.find(({ id }) => id === input.atomId);
  if (!atom) {
    throw new RichContentError("atom-not-found", `Atom '${input.atomId}' was not found`);
  }
  if (atom.kind !== "text") {
    throw new RichContentError("invalid-atom-range", "Only text atoms accept text ranges");
  }
  validateRange(atom, input);

  const { start, end } = input.range;
  const nextAtom: TextAtom = {
    ...atom,
    text: `${atom.text.slice(0, start)}${input.text}${atom.text.slice(end)}`
  };
  return {
    atoms: content.atoms.map((candidate) => (candidate.id === nextAtom.id ? nextAtom : candidate)),
    marks: transformMarks(content.marks, atom, nextAtom, start, end, input.text.length)
  };
};
