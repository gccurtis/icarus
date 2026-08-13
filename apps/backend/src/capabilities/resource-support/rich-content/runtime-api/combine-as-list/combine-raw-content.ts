import { RichContentError } from "#rich-content/errors.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { ListPresentation } from "#rich-content/types/formatting.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type {
  LinkMark,
  RawAtom,
  RawContent,
  RawMark,
  RawPosition,
  RawRange,
  StyleMark
} from "#rich-content/types/raw-content.js";
import { copyListPresentation } from "#rich-content/runtime-api/shared/list.js";
import {
  lineRange,
  rawLines
} from "#rich-content/runtime-api/shared/raw-lines.js";

const cloneAtom = (atom: RawAtom, id: string): RawAtom => {
  switch (atom.kind) {
    case "text":
      return { id, kind: "text", text: atom.text };
    case "line-break":
      return { id, kind: "line-break" };
  }
};

const cloneMark = (
  mark: StyleMark | LinkMark,
  id: string,
  range: RawRange
): StyleMark | LinkMark =>
  mark.kind === "style"
    ? { id, kind: "style", range, properties: { ...mark.properties } }
    : { id, kind: "link", range, targets: mark.targets.map((target) => ({ ...target })) };

/**
 * Copies each source's atoms in caller order into one new version-1 object,
 * remapping style and link marks onto the copies. The copy is atom-based, not
 * text-based, which is why inline formatting survives grouping.
 */
export const combineRawContentAsList = (
  sources: readonly RawContent[],
  id: RichContentId,
  presentation: ListPresentation,
  ids: RichContentIdFactory
): RawContent => {
  if (sources.length === 0) {
    throw new RichContentError("invalid-list-source", "A list requires at least one item");
  }
  const listId = ids.listId();
  const atoms: RawAtom[] = [];
  const marks: RawMark[] = [];

  sources.forEach((source, sourceIndex) => {
    const lines = rawLines(source);
    if (lines.length !== 1) {
      throw new RichContentError(
        "invalid-list-source",
        `Rich Content '${source.id}' must be split into one logical line before grouping`
      );
    }

    if (sourceIndex > 0) atoms.push({ id: ids.atomId(), kind: "line-break" });
    const atomIds = new Map<string, string>();
    const itemAtoms = source.atoms.map((atom) => {
      const atomId = ids.atomId();
      atomIds.set(atom.id, atomId);
      return cloneAtom(atom, atomId);
    });
    atoms.push(...itemAtoms);

    const mapPosition = (position: RawPosition): RawPosition => {
      const atomId = atomIds.get(position.atomId);
      if (!atomId) throw new Error("Rich Content list invariant violated: atom mapping missing");
      return { atomId, offset: position.offset };
    };
    for (const mark of source.marks) {
      if (mark.kind === "list-item") continue;
      marks.push(cloneMark(mark, ids.markId(), {
        start: mapPosition(mark.range.start),
        end: mapPosition(mark.range.end)
      }));
    }

    const itemContent: RawContent = {
      id,
      version: 1,
      atoms: itemAtoms,
      marks: []
    };
    marks.push({
      id: ids.markId(),
      kind: "list-item",
      range: lineRange(rawLines(itemContent)[0]!),
      listId,
      presentation: copyListPresentation(presentation)
    });
  });

  return { id, version: 1, atoms, marks };
};
