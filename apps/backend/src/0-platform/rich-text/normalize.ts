// Normalization — produce canonical form of RichContent.
// Idempotent: normalize(normalize(C)) === normalize(C).

import type { RichContent, RichTextAtom, RichTextMark } from "./types.js";

export function normalize(content: RichContent): RichContent {
  let { atoms, marks } = content;

  // 1. Snap mark ranges to whole atoms for non-text atoms
  marks = snapMarkRanges(marks, atoms);

  // 2. Remove marks whose ranges are empty
  marks = marks.filter((m) => !isEmptyRange(m.range));

  // 3. Merge adjacent TextAtoms
  atoms = mergeTextAtoms(atoms);

  // 4. Remap mark ranges after atom merging, and remove marks
  //    referencing non-existent atoms
  marks = remapAndFilterMarks(marks, atoms);

  // 5. Remove duplicate adjacent equivalent marks
  marks = deduplicateMarks(marks);

  // 6. Sort marks by range start position
  marks = sortMarks(marks, atoms);

  return { atoms, marks };
}

// ── Range snapping ───────────────────────────────────────────────────────

function isEmptyRange(range: { start: { atomId: string; offset: number }; end: { atomId: string; offset: number } }): boolean {
  return range.start.atomId === range.end.atomId && range.start.offset === range.end.offset;
}

function snapMarkRanges(
  marks: RichTextMark[],
  atoms: RichTextAtom[],
): RichTextMark[] {
  const atomMap = new Map(atoms.map((a) => [a.id, a]));

  return marks.map((mark) => {
    const startAtom = atomMap.get(mark.range.start.atomId);
    const endAtom = atomMap.get(mark.range.end.atomId);
    if (!startAtom || !endAtom) return mark;

    let { start, end } = mark.range;

    // Snap start to 0 if the start atom is non-text
    if (startAtom.kind !== "text") {
      start = { atomId: start.atomId, offset: 0 };
    }

    // Snap end to whole atom if the end atom is non-text
    if (endAtom.kind !== "text") {
      const endLen = getAtomLength(endAtom);
      end = { atomId: end.atomId, offset: endLen };
    }

    // Also check if any non-text atom between start and end is partially covered
    const startIdx = atoms.findIndex((a) => a.id === start.atomId);
    const endIdx = atoms.findIndex((a) => a.id === end.atomId);

    if (startIdx >= 0 && endIdx >= 0) {
      for (let i = startIdx; i <= endIdx; i++) {
        const atom = atoms[i];
        if (atom && atom.kind !== "text") {
          // If this non-text atom is at the boundary, snap its side
          if (i === startIdx) {
            start = { atomId: atom.id, offset: 0 };
          }
          if (i === endIdx) {
            const len = getAtomLength(atom);
            end = { atomId: atom.id, offset: len };
          }
        }
      }
    }

    if (start !== mark.range.start || end !== mark.range.end) {
      return { ...mark, range: { start, end } } as RichTextMark;
    }
    return mark;
  });
}

function getAtomLength(atom: RichTextAtom): number {
  switch (atom.kind) {
    case "text":
      return atom.text.length;
    case "formula":
    case "reference":
      return atom.displayText.length;
    case "hard-break":
      return 0;
  }
}

// ── Text atom merging ────────────────────────────────────────────────────

function mergeTextAtoms(atoms: RichTextAtom[]): RichTextAtom[] {
  if (atoms.length === 0) return atoms;

  const result: RichTextAtom[] = [atoms[0]];

  for (let i = 1; i < atoms.length; i++) {
    const prev = result[result.length - 1];
    const curr = atoms[i];

    if (prev.kind === "text" && curr.kind === "text") {
      // Merge: preserve the first atom's ID, concatenate text
      result[result.length - 1] = {
        ...prev,
        text: prev.text + curr.text,
      };
    } else {
      result.push(curr);
    }
  }

  return result;
}

// ── Mark remapping after atom merge ──────────────────────────────────────

function remapAndFilterMarks(
  marks: RichTextMark[],
  atoms: RichTextAtom[],
): RichTextMark[] {
  const atomMap = new Map(atoms.map((a) => [a.id, a]));
  const result: RichTextMark[] = [];

  for (const mark of marks) {
    const startAtom = atomMap.get(mark.range.start.atomId);
    const endAtom = atomMap.get(mark.range.end.atomId);
    if (!startAtom || !endAtom) continue; // dead mark — remove

    // Check offsets are still in bounds
    if (
      mark.range.start.offset < 0 ||
      (startAtom.kind === "text" && mark.range.start.offset > startAtom.text.length)
    ) {
      continue;
    }
    if (
      mark.range.end.offset < 0 ||
      (endAtom.kind === "text" && mark.range.end.offset > endAtom.text.length)
    ) {
      continue;
    }

    result.push(mark);
  }

  return result;
}

// ── Deduplication ────────────────────────────────────────────────────────

function deduplicateMarks(marks: RichTextMark[]): RichTextMark[] {
  const result: RichTextMark[] = [];
  for (const mark of marks) {
    const last = result[result.length - 1];
    if (last && marksEqual(last, mark)) continue;
    result.push(mark);
  }
  return result;
}

function marksEqual(a: RichTextMark, b: RichTextMark): boolean {
  if (a.kind !== b.kind) return false;
  if (!rangesEqual(a.range, b.range)) return false;

  // Compare kind-specific fields
  if (a.kind === "link" && b.kind === "link") {
    return JSON.stringify(a.targets) === JSON.stringify(b.targets);
  }
  if (a.kind === "style" && b.kind === "style") {
    return JSON.stringify(a.properties) === JSON.stringify(b.properties);
  }

  return true;
}

function rangesEqual(a: { start: { atomId: string; offset: number }; end: { atomId: string; offset: number } }, b: { start: { atomId: string; offset: number }; end: { atomId: string; offset: number } }): boolean {
  return (
    a.start.atomId === b.start.atomId &&
    a.start.offset === b.start.offset &&
    a.end.atomId === b.end.atomId &&
    a.end.offset === b.end.offset
  );
}

// ── Sorting ──────────────────────────────────────────────────────────────

function sortMarks(marks: RichTextMark[], atoms: RichTextAtom[]): RichTextMark[] {
  const atomIndex = new Map(atoms.map((a, i) => [a.id, i]));

  return [...marks].sort((a, b) => {
    const aIdx = atomIndex.get(a.range.start.atomId) ?? 0;
    const bIdx = atomIndex.get(b.range.start.atomId) ?? 0;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.range.start.offset - b.range.start.offset;
  });
}