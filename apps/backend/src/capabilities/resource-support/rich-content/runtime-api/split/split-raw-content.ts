import { RichContentError } from "#rich-content/errors.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type {
  LinkMark,
  RawAtom,
  RawContent,
  RawMark,
  RawPosition,
  RawRange,
  StyleMark,
  TextAtom
} from "#rich-content/types/raw-content.js";
import {
  numericRange,
  rawOffset
} from "#rich-content/runtime-api/shared/ranges.js";

export interface SplitRawContentResult {
  readonly left: RawContent;
  readonly right: RawContent;
}

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
 * Divides one content object into two independent version-1 objects. Both
 * results own fresh atom and mark IDs, because neither inherits the source's
 * identity. List-item marks are dropped so both results start ungrouped.
 */
export const splitRawContent = (
  content: RawContent,
  at: RawPosition,
  leftId: RichContentId,
  rightId: RichContentId,
  ids: RichContentIdFactory
): SplitRawContentResult => {
  const targetIndex = content.atoms.findIndex(({ id }) => id === at.atomId);
  const target = content.atoms[targetIndex];
  if (!target || target.kind !== "text") {
    throw new RichContentError("atom-not-found", "Split position atom was not found");
  }
  if (!Number.isInteger(at.offset) || at.offset < 0 || at.offset > target.text.length) {
    throw new RichContentError("invalid-atom-range", "Split position is invalid");
  }

  const leftAtomIds = new Map<string, string>();
  const rightAtomIds = new Map<string, string>();
  const leftAtoms: RawAtom[] = [];
  const rightAtoms: RawAtom[] = [];
  let leftTarget: TextAtom | undefined;
  let rightTarget: TextAtom | undefined;
  const separatorBefore = at.offset === 0 && content.atoms[targetIndex - 1]?.kind === "line-break"
    ? targetIndex - 1
    : undefined;
  const separatorAfter =
    at.offset === target.text.length && content.atoms[targetIndex + 1]?.kind === "line-break"
      ? targetIndex + 1
      : undefined;

  content.atoms.forEach((atom, index) => {
    if (index < targetIndex) {
      if (index === separatorBefore) return;
      const id = ids.atomId();
      leftAtomIds.set(atom.id, id);
      leftAtoms.push(cloneAtom(atom, id));
      return;
    }
    if (index > targetIndex) {
      if (index === separatorAfter) return;
      const id = ids.atomId();
      rightAtomIds.set(atom.id, id);
      rightAtoms.push(cloneAtom(atom, id));
      return;
    }
    leftTarget = { id: ids.atomId(), kind: "text", text: target.text.slice(0, at.offset) };
    rightTarget = { id: ids.atomId(), kind: "text", text: target.text.slice(at.offset) };
    leftAtomIds.set(target.id, leftTarget.id);
    rightAtomIds.set(target.id, rightTarget.id);
    leftAtoms.push(leftTarget);
    rightAtoms.push(rightTarget);
  });

  if (!leftTarget || !rightTarget) {
    throw new Error("Rich Content split invariant violated: target atoms were not created");
  }

  const splitOffset = rawOffset(content, at);
  const mapPosition = (
    position: RawPosition,
    side: "left" | "right"
  ): RawPosition => {
    if (position.atomId === target.id) {
      return side === "left"
        ? { atomId: leftTarget!.id, offset: position.offset }
        : { atomId: rightTarget!.id, offset: position.offset - at.offset };
    }
    const atomId = (side === "left" ? leftAtomIds : rightAtomIds).get(position.atomId);
    if (!atomId) throw new Error("Rich Content split invariant violated: atom mapping missing");
    return { atomId, offset: position.offset };
  };
  const boundary = (side: "left" | "right"): RawPosition =>
    side === "left"
      ? { atomId: leftTarget!.id, offset: leftTarget!.text.length }
      : { atomId: rightTarget!.id, offset: 0 };

  const leftMarks: RawMark[] = [];
  const rightMarks: RawMark[] = [];
  for (const mark of content.marks) {
    if (mark.kind === "list-item") continue;
    const interval = numericRange(content, mark.range);
    if (interval.start < splitOffset) {
      leftMarks.push(cloneMark(mark, ids.markId(), {
        start: mapPosition(mark.range.start, "left"),
        end: interval.end <= splitOffset
          ? mapPosition(mark.range.end, "left")
          : boundary("left")
      }));
    }
    if (interval.end > splitOffset) {
      rightMarks.push(cloneMark(mark, ids.markId(), {
        start: interval.start >= splitOffset
          ? mapPosition(mark.range.start, "right")
          : boundary("right"),
        end: mapPosition(mark.range.end, "right")
      }));
    }
  }

  return {
    left: { id: leftId, version: 1, atoms: leftAtoms, marks: leftMarks },
    right: { id: rightId, version: 1, atoms: rightAtoms, marks: rightMarks }
  };
};
