import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type {
  RawAtom,
  RawContent
} from "#rich-content/types/raw-content.js";

/**
 * Builds version-1 Raw Content from plain text. Newlines become line-break
 * atoms, so every logical line gets exactly one addressable text atom —
 * including trailing and empty lines.
 */
export const createRawContent = (
  id: RichContentId,
  initialText: string,
  ids: RichContentIdFactory
): RawContent => {
  const sourceLines = initialText.split("\n");
  const atoms: RawAtom[] = [];

  sourceLines.forEach((text, index) => {
    atoms.push({ id: ids.atomId(), kind: "text", text });
    if (index < sourceLines.length - 1) {
      atoms.push({ id: ids.atomId(), kind: "line-break" });
    }
  });

  return { id, version: 1, atoms, marks: [] };
};
