/**
 * Raw Content exactly as it sits in the `raw_content` JSONB column, plus the
 * translations between that shape and the canonical types in `types/`.
 *
 * The stored shape omits `id` and `version`, which live in their own columns,
 * and it still admits the retired `"hard-break"` atom discriminator that older
 * rows were written with. Neither fact is allowed to reach the rest of the
 * capability, so a row is never handed out untranslated.
 */
import type {
  RawAtom,
  RawContent,
  RawMark
} from "#rich-content/types/raw-content.js";

export interface StoredRawContent {
  readonly atoms: readonly RawAtom[];
  readonly marks: readonly RawMark[];
}

/** The retired line-break discriminator, still present in rows never rewritten. */
export interface LegacyLineBreakAtom {
  readonly id: string;
  readonly kind: "hard-break";
}

export type StoredAtom = RawAtom | LegacyLineBreakAtom;

/** Canonical to stored. Identity today; the translation point is what matters. */
export const storedRawContent = (content: RawContent): StoredRawContent => ({
  atoms: content.atoms,
  marks: content.marks
});

/** Stored to canonical: rewrites `"hard-break"` as the current `"line-break"`. */
export const currentAtoms = (
  atoms: readonly StoredAtom[]
): readonly RawAtom[] =>
  atoms.map((atom) =>
    atom.kind === "hard-break"
      ? { id: atom.id, kind: "line-break" }
      : atom
  );
