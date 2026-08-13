import { RichContentError } from "#rich-content/errors.js";
import type {
  RawAtom,
  RawContent,
  RawMark,
  RawPosition,
  TextAtom
} from "#rich-content/types/raw-content.js";
import type { ReplaceTextInput } from "#rich-content/types/runtime-inputs.js";

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
 * Rewrites one text atom and moves every mark boundary that the edit displaced.
 * The atom keeps its ID, so a display handle for a neighbouring atom stays
 * meaningful and a list mark keeps covering its whole line.
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
    atoms: content.atoms.map((candidate) =>
      candidate.id === nextAtom.id ? nextAtom : candidate
    ),
    marks: transformMarks(
      content.marks,
      atom,
      nextAtom,
      start,
      end,
      input.text.length
    )
  };
};
