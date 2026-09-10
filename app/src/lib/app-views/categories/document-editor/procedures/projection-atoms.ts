import type { Atom, MarkEnd } from "$representation/data/types/content/content-block";
import { displayOfAtom } from "$representation/data/behavior/content/positions";

export { displayOfAtom };

export type Segment = {
  readonly atom: Atom;
  readonly start: number;
  readonly end: number;
};

export const segmentsOf = (atoms: readonly Atom[]): readonly Segment[] => {
  const segments: Segment[] = [];
  let at = 0;

  for (const atom of atoms) {
    const length = displayOfAtom(atom).length;
    segments.push({ atom, start: at, end: at + length });
    at += length;
  }

  return segments;
};

export const linearOf = (atoms: readonly Atom[], end: MarkEnd): number => {
  const segments = segmentsOf(atoms);
  const held = segments.find((segment) => segment.atom.id === end.atom);
  if (held === undefined) return 0;

  return held.start + Math.min(Math.max(end.offset, 0), held.end - held.start);
};

export const endAt = (atoms: readonly Atom[], linear: number, bias: "from" | "to"): MarkEnd => {
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
