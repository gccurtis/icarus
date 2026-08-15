import type { RawAtom, RawContent, RawMark } from "$rich-content/types/raw-content";

/**
 * Raw Content exactly as it sits in the `raw_content` jsonb column, and the
 * translations between that shape and the canonical types in `types/`.
 *
 * The stored shape omits `id` and `version`, which live in their own columns —
 * `version` because compare-and-swap needs it as a predicate, and `id` because
 * it is the primary key.
 *
 * It also still admits the retired `"hard-break"` discriminator that older rows
 * were written with. **Neither fact is allowed to reach the rest of the
 * capability**, which is why a row is never handed out untranslated.
 */
export interface StoredRawContent {
  readonly atoms: readonly RawAtom[];
  readonly marks: readonly RawMark[];
}

/**
 * The retired line-break discriminator, still present in rows never rewritten.
 *
 * This is a migration living at the read boundary rather than in a migration
 * script, and deliberately: rewriting every row to rename one string would be a
 * table-wide write for something a three-line map handles on the way past. It
 * can be deleted once no row carries it, and nothing above here would notice.
 */
export interface LegacyLineBreakAtom {
  readonly id: string;
  readonly kind: "hard-break";
}

export type StoredAtom = RawAtom | LegacyLineBreakAtom;

/**
 * Canonical to stored.
 *
 * Identity today. It exists anyway because it is the one place the translation
 * would go, and a caller that inlined `{ atoms, marks }` would be the reason a
 * future change had to be made in eleven places.
 */
export const storedRawContent = (content: RawContent): StoredRawContent => ({
  atoms: content.atoms,
  marks: content.marks
});

/** Stored to canonical: rewrites `"hard-break"` as the current `"line-break"`. */
export const currentAtoms = (atoms: readonly StoredAtom[]): readonly RawAtom[] =>
  atoms.map((atom) => (atom.kind === "hard-break" ? { id: atom.id, kind: "line-break" } : atom));
