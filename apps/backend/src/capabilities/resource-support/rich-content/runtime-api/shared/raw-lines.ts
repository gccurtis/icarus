/**
 * Logical lines, derived from atom order. Lines are never stored: a line break
 * is an atom, and everything between two of them is one line.
 */
import type {
  ListItemMark,
  RawContent,
  RawLine,
  RawRange,
  TextAtom
} from "#rich-content/types/raw-content.js";

export const rawLines = (content: RawContent): RawLine[] => {
  const lines: RawLine[] = [];
  let atoms: TextAtom[] = [];

  for (const atom of content.atoms) {
    if (atom.kind === "line-break") {
      lines.push({ index: lines.length, atoms });
      atoms = [];
      continue;
    }
    atoms.push(atom);
  }
  lines.push({ index: lines.length, atoms });
  return lines;
};

export const lineRange = (line: RawLine): RawRange => {
  const first = line.atoms[0];
  const last = line.atoms.at(-1);
  if (!first || !last) {
    throw new Error("Raw Content invariant violated: every line needs a text atom");
  }
  return {
    start: { atomId: first.id, offset: 0 },
    end: { atomId: last.id, offset: last.text.length }
  };
};

export const listMarkForLine = (
  content: RawContent,
  line: RawLine
): ListItemMark | undefined => {
  const atomIds = new Set(line.atoms.map(({ id }) => id));
  return content.marks.find(
    (mark): mark is ListItemMark =>
      mark.kind === "list-item" && atomIds.has(mark.range.start.atomId)
  );
};
