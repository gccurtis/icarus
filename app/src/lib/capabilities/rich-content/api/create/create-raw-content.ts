import { atomId } from "$rich-content/api/shared/ids";
import type { RichContentId } from "$rich-content/types/ids";
import type { RawAtom, RawContent } from "$rich-content/types/raw-content";

/**
 * Builds version-1 Raw Content from plain text.
 *
 * Newlines become line-break atoms, so **every logical line gets exactly one
 * addressable text atom** — including trailing and empty ones. That uniformity
 * is what `rawLines` and `lineRange` depend on: a line with no text atom has no
 * range, and `lineRange` throws rather than guess.
 */
export const createRawContent = (id: RichContentId, initialText: string): RawContent => {
  const sourceLines = initialText.split("\n");
  const atoms: RawAtom[] = [];

  sourceLines.forEach((text, index) => {
    atoms.push({ id: atomId(), kind: "text", text });
    if (index < sourceLines.length - 1) {
      atoms.push({ id: atomId(), kind: "line-break" });
    }
  });

  return { id, version: 1, atoms, marks: [] };
};
