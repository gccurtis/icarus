import { RichContentError } from "$rich-content/errors";
import { atomId as newAtomId, listId as newListId, markId } from "$rich-content/api/shared/ids";
import { copyListPresentation } from "$rich-content/api/shared/list";
import { lineRange, rawLines } from "$rich-content/api/shared/raw-lines";
import type { ListPresentation } from "$rich-content/types/formatting";
import type { RichContentId } from "$rich-content/types/ids";
import type {
  LinkMark,
  RawAtom,
  RawContent,
  RawMark,
  RawPosition,
  RawRange,
  StyleMark
} from "$rich-content/types/raw-content";

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
 * Copies each source's atoms, in caller order, into one new version-1 object.
 *
 * **The copy is atom-based, not text-based**, which is the reason inline
 * formatting survives grouping: every style and link mark is remapped onto the
 * copied atoms rather than being lost to a string concatenation.
 *
 * Each source must already be **one logical line**. A multi-line source would
 * become several list items from one input, and which of them the caller meant
 * is not recoverable — so it is refused and the caller splits first.
 */
export const combineRawContentAsList = (
  sources: readonly RawContent[],
  id: RichContentId,
  presentation: ListPresentation
): RawContent => {
  if (sources.length === 0) {
    throw new RichContentError("invalid-list-source", "A list requires at least one item");
  }
  const listId = newListId();
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

    if (sourceIndex > 0) atoms.push({ id: newAtomId(), kind: "line-break" });
    const atomIds = new Map<string, string>();
    const itemAtoms = source.atoms.map((atom) => {
      const atomId = newAtomId();
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
      // A source's own list membership does not survive: it is becoming an item
      // in *this* list, and carrying the old one would put it in two.
      if (mark.kind === "list-item") continue;
      marks.push(
        cloneMark(mark, markId(), {
          start: mapPosition(mark.range.start),
          end: mapPosition(mark.range.end)
        })
      );
    }

    const itemContent: RawContent = { id, version: 1, atoms: itemAtoms, marks: [] };
    marks.push({
      id: markId(),
      kind: "list-item",
      range: lineRange(rawLines(itemContent)[0]!),
      listId,
      presentation: copyListPresentation(presentation)
    });
  });

  return { id, version: 1, atoms, marks };
};
