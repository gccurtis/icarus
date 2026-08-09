// Deep clone of RichContent with fresh IDs.

import type { RichContent, RichTextIdFactory } from "./types.js";

/**
 * Deep-clone RichContent, assigning fresh IDs to every atom and mark.
 * The atoms list and marks list are new arrays. Each atom and mark is a
 * shallow copy with a new ID. Properties, targets, and text remain shared.
 */
export function clone(
  content: RichContent,
  ids: RichTextIdFactory,
): RichContent {
  const atomIdMap = new Map<string, string>();

  const atoms = content.atoms.map((atom) => {
    const newId = ids.atomId();
    atomIdMap.set(atom.id, newId);
    return { ...atom, id: newId };
  });

  const marks = content.marks.map((mark) => {
    const newId = ids.markId();
    const newRange = {
      start: {
        atomId: atomIdMap.get(mark.range.start.atomId) ?? mark.range.start.atomId,
        offset: mark.range.start.offset,
      },
      end: {
        atomId: atomIdMap.get(mark.range.end.atomId) ?? mark.range.end.atomId,
        offset: mark.range.end.offset,
      },
    };
    return { ...mark, id: newId, range: newRange } as typeof mark;
  });

  return { atoms, marks };
}