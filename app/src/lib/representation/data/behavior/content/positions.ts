import type {
  Atom,
  Mark,
  MarkEnd
} from "$representation/data/types/content/content-block";

/**
 * A template atom shows its parameter's name in braces, so a hole reads as one
 * wherever prose is measured or drawn, and so its width is stable.
 */
export const displayOfAtom = (atom: Atom): string =>
  atom.kind === "literal"
    ? atom.text
    : atom.kind === "template"
      ? `{${atom.name}}`
      : atom.lastResolvedDisplay;

export type AtomSegment = {
  readonly atom: Atom;
  readonly start: number;
  readonly end: number;
};

export const segmentsOf = (atoms: readonly Atom[]): readonly AtomSegment[] => {
  const segments: AtomSegment[] = [];
  let at = 0;

  for (const atom of atoms) {
    const length = displayOfAtom(atom).length;
    segments.push({ atom, start: at, end: at + length });
    at += length;
  }

  return segments;
};

/** Resolve an atom-relative endpoint onto the block's flat display string. */
export const linearOf = (atoms: readonly Atom[], end: MarkEnd): number => {
  const held = segmentsOf(atoms).find((segment) => segment.atom.id === end.atom);
  if (held === undefined) return 0;

  return held.start + Math.min(Math.max(end.offset, 0), held.end - held.start);
};

/** Resolve a flat display offset back onto a stable atom-relative endpoint. */
export const endAt = (
  atoms: readonly Atom[],
  linear: number,
  bias: "from" | "to"
): MarkEnd => {
  const segments = segmentsOf(atoms);
  if (segments.length === 0) return { atom: "", offset: 0 };

  const candidates =
    bias === "from"
      ? segments.filter((segment) => linear < segment.end)
      : segments.filter((segment) => linear > segment.start);

  const held =
    bias === "from"
      ? (candidates[0] ?? segments[segments.length - 1])
      : (candidates[candidates.length - 1] ?? segments[0]);

  return {
    atom: held.atom.id,
    offset: Math.min(Math.max(linear - held.start, 0), held.end - held.start)
  };
};

export const rangeOf = (
  atoms: readonly Atom[],
  mark: Mark
): { readonly from: number; readonly to: number } => ({
  from: linearOf(atoms, mark.from),
  to: linearOf(atoms, mark.to)
});
