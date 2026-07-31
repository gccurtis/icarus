// RichTextOperation application — apply a batch of operations to RichContent
// and produce the result, inverse, and footprint.

import type {
  RichContent,
  RichTextAtom,
  RichTextMark,
  RichTextOperation,
  ApplyResult,
  TextPosition,
  TextRange,
} from "./types.js";

export function applyOperations(
  content: RichContent,
  operations: RichTextOperation[],
): ApplyResult {
  let current: RichContent = deepCopyContent(content);
  const inverseOps: RichTextOperation[] = [];
  const affectedAtomIds = new Set<string>();
  let dirtyRange: TextRange | undefined;

  for (const op of operations) {
    const { content: next, inverse, affected, dirty } = applyOne(current, op);
    inverseOps.unshift(inverse);
    for (const id of affected) affectedAtomIds.add(id);
    if (dirty) dirtyRange = dirty;
    current = next;
  }

  return {
    content: current,
    inverse: inverseOps,
    footprint: {
      affectedAtomIds: [...affectedAtomIds],
      dirtyRange,
    },
  };
}

function applyOne(
  content: RichContent,
  op: RichTextOperation,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  switch (op.type) {
    case "insert-text":
      return applyInsertText(content, op.at, op.text);
    case "delete-range":
      return applyDeleteRange(content, op.range);
    case "replace-range":
      return applyReplaceRange(content, op.range, op.text);
    case "insert-atom":
      return applyInsertAtom(content, op.at, op.atom);
    case "delete-atom":
      return applyDeleteAtom(content, op.atomId);
    case "add-mark":
      return applyAddMark(content, op.mark);
    case "remove-mark":
      return applyRemoveMark(content, op.markId);
    case "set-link-targets":
      return applySetLinkTargets(content, op.markId, op.targets);
    case "set-formula-expression":
      return applySetFormulaExpression(content, op.atomId, op.expression);
    case "apply-formula-result":
      return applyApplyFormulaResult(
        content,
        op.atomId,
        op.value,
        op.displayText,
      );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function deepCopyContent(content: RichContent): RichContent {
  return {
    atoms: content.atoms.map((a) => ({ ...a } as RichTextAtom)),
    marks: content.marks.map((m) => ({ ...m } as RichTextMark)),
  };
}

function findAtomIndex(
  atoms: RichTextAtom[],
  atomId: string,
): number {
  return atoms.findIndex((a) => a.id === atomId);
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

// ── Text operations ──────────────────────────────────────────────────────

function applyInsertText(
  content: RichContent,
  at: TextPosition,
  text: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = findAtomIndex(content.atoms, at.atomId);
  if (idx === -1) throw new Error(`Atom not found: ${at.atomId}`);

  const atom = content.atoms[idx];
  if (atom.kind !== "text") {
    throw new Error(`insert-text requires a text atom, got: ${atom.kind}`);
  }

  if (at.offset < 0 || at.offset > atom.text.length) {
    throw new Error(
      `Offset ${at.offset} out of bounds for atom ${atom.id} (length ${atom.text.length})`,
    );
  }

  const newText = atom.text.slice(0, at.offset) + text + atom.text.slice(at.offset);
  content.atoms[idx] = { ...atom, text: newText };

  return {
    content,
    inverse: {
      type: "delete-range",
      range: {
        start: at,
        end: { atomId: at.atomId, offset: at.offset + text.length },
      },
    },
    affected: [atom.id],
    dirty: {
      start: at,
      end: { atomId: at.atomId, offset: at.offset + text.length },
    },
  };
}

function applyDeleteRange(
  content: RichContent,
  range: TextRange,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const { atoms } = content;
  const startIdx = findAtomIndex(atoms, range.start.atomId);
  const endIdx = findAtomIndex(atoms, range.end.atomId);

  if (startIdx === -1) throw new Error(`Start atom not found: ${range.start.atomId}`);
  if (endIdx === -1) throw new Error(`End atom not found: ${range.end.atomId}`);

  // Collect deleted text for inverse
  // For simplicity, we handle single-atom deletion
  if (startIdx === endIdx) {
    const atom = atoms[startIdx];
    if (atom.kind !== "text") {
      throw new Error(`delete-range requires text atoms, got: ${atom.kind}`);
    }
    const deleted = atom.text.slice(range.start.offset, range.end.offset);
    const newText = atom.text.slice(0, range.start.offset) + atom.text.slice(range.end.offset);
    content.atoms[startIdx] = { ...atom, text: newText };

    return {
      content,
      inverse: {
        type: "insert-text",
        at: range.start,
        text: deleted,
      },
      affected: [atom.id],
      dirty: range,
    };
  }

  // Cross-atom deletion: delete from start atom to end of start atom,
  // remove all atoms in between, delete from start of end atom to range.end
  const deletedTexts: string[] = [];
  const startAtom = atoms[startIdx];
  if (startAtom.kind === "text") {
    deletedTexts.push(startAtom.text.slice(range.start.offset));
    content.atoms[startIdx] = {
      ...startAtom,
      text: startAtom.text.slice(0, range.start.offset),
    };
  }

  const endAtom = atoms[endIdx];
  if (endAtom.kind === "text") {
    deletedTexts.unshift(endAtom.text.slice(0, range.end.offset));
    content.atoms[endIdx] = {
      ...endAtom,
      text: endAtom.text.slice(range.end.offset),
    };
  }

  // Remove in-between atoms
  const removedIds: string[] = [];
  for (let i = endIdx - 1; i > startIdx; i--) {
    removedIds.push(atoms[i].id);
    content.atoms.splice(i, 1);
  }

  return {
    content,
    inverse: {
      type: "insert-text",
      at: range.start,
      text: deletedTexts.join(""),
    },
    affected: [startAtom.id, endAtom.id, ...removedIds],
    dirty: range,
  };
}

function applyReplaceRange(
  content: RichContent,
  range: TextRange,
  text: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  // Replace = delete range + insert text
  const delResult = applyDeleteRange(content, range);
  const insResult = applyInsertText(delResult.content, range.start, text);

  return {
    content: insResult.content,
    inverse: {
      type: "replace-range",
      range: {
        start: range.start,
        end: { atomId: range.start.atomId, offset: range.start.offset + text.length },
      },
      text: "", // The inverse of replace is another replace — simplified
    },
    affected: [...delResult.affected, ...insResult.affected],
    dirty: insResult.dirty,
  };
}

// ── Atom operations ──────────────────────────────────────────────────────

function applyInsertAtom(
  content: RichContent,
  at: TextPosition,
  atom: RichTextAtom,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = findAtomIndex(content.atoms, at.atomId);
  if (idx === -1) throw new Error(`Atom not found: ${at.atomId}`);

  // Split the current atom at the offset if it's a text atom
  const curr = content.atoms[idx];
  if (curr.kind === "text" && at.offset > 0 && at.offset < curr.text.length) {
    const before = curr.text.slice(0, at.offset);
    const after = curr.text.slice(at.offset);
    content.atoms[idx] = { ...curr, text: before };
    content.atoms.splice(idx + 1, 0, atom);
    content.atoms.splice(idx + 2, 0, { ...curr, text: after });
  } else if (curr.kind === "text" && at.offset === 0) {
    content.atoms.splice(idx, 0, atom);
  } else {
    content.atoms.splice(idx + 1, 0, atom);
  }

  return {
    content,
    inverse: { type: "delete-atom", atomId: atom.id },
    affected: [atom.id, curr.id],
    dirty: {
      start: { atomId: atom.id, offset: 0 },
      end: { atomId: atom.id, offset: getAtomLength(atom) },
    },
  };
}

function applyDeleteAtom(
  content: RichContent,
  atomId: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = findAtomIndex(content.atoms, atomId);
  if (idx === -1) throw new Error(`Atom not found: ${atomId}`);

  const deleted = content.atoms[idx];
  content.atoms.splice(idx, 1);

  // Remove marks that reference the deleted atom
  const keptMarks: RichTextMark[] = [];
  for (const m of content.marks) {
    if (m.range.start.atomId !== atomId && m.range.end.atomId !== atomId) {
      keptMarks.push(m);
    }
  }
  // Mutate: splice the marks array in place
  content.marks.length = 0;
  for (const m of keptMarks) {
    content.marks.push(m);
  }

  return {
    content,
    inverse: {
      type: "insert-atom",
      at: { atomId: deleted.id, offset: 0 },
      atom: deleted,
    },
    affected: [atomId],
    dirty: {
      start: { atomId: deleted.id, offset: 0 },
      end: { atomId: deleted.id, offset: getAtomLength(deleted) },
    },
  };
}

// ── Mark operations ──────────────────────────────────────────────────────

function applyAddMark(
  content: RichContent,
  mark: RichTextMark,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  content.marks.push(mark);
  return {
    content,
    inverse: { type: "remove-mark", markId: mark.id },
    affected: [mark.range.start.atomId, mark.range.end.atomId],
    dirty: mark.range,
  };
}

function applyRemoveMark(
  content: RichContent,
  markId: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = content.marks.findIndex((m) => m.id === markId);
  if (idx === -1) throw new Error(`Mark not found: ${markId}`);

  const removed = content.marks[idx];
  content.marks.splice(idx, 1);

  return {
    content,
    inverse: { type: "add-mark", mark: removed },
    affected: [removed.range.start.atomId, removed.range.end.atomId],
    dirty: removed.range,
  };
}

function applySetLinkTargets(
  content: RichContent,
  markId: string,
  targets: { readonly kind: string; [key: string]: unknown }[],
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = content.marks.findIndex((m) => m.id === markId);
  if (idx === -1) throw new Error(`Mark not found: ${markId}`);

  const mark = content.marks[idx];
  if (mark.kind !== "link") throw new Error(`Mark ${markId} is not a link mark`);

  const oldTargets = mark.targets;
  content.marks[idx] = { ...mark, targets: targets as typeof mark.targets };

  return {
    content,
    inverse: { type: "set-link-targets", markId, targets: oldTargets },
    affected: [mark.range.start.atomId, mark.range.end.atomId],
    dirty: mark.range,
  };
}

// ── Formula operations ───────────────────────────────────────────────────

function applySetFormulaExpression(
  content: RichContent,
  atomId: string,
  expression: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = findAtomIndex(content.atoms, atomId);
  if (idx === -1) throw new Error(`Atom not found: ${atomId}`);

  const atom = content.atoms[idx];
  if (atom.kind !== "formula") {
    throw new Error(`set-formula-expression requires a formula atom, got: ${atom.kind}`);
  }

  const oldExpression = atom.expression;
  content.atoms[idx] = { ...atom, expression };

  return {
    content,
    inverse: { type: "set-formula-expression", atomId, expression: oldExpression },
    affected: [atomId],
    dirty: { start: { atomId, offset: 0 }, end: { atomId, offset: atom.displayText.length } },
  };
}

function applyApplyFormulaResult(
  content: RichContent,
  atomId: string,
  value: unknown,
  displayText: string,
): {
  content: RichContent;
  inverse: RichTextOperation;
  affected: string[];
  dirty?: TextRange;
} {
  const idx = findAtomIndex(content.atoms, atomId);
  if (idx === -1) throw new Error(`Atom not found: ${atomId}`);

  const atom = content.atoms[idx];
  if (atom.kind !== "formula") {
    throw new Error(`apply-formula-result requires a formula atom, got: ${atom.kind}`);
  }

  const oldValue = atom.acceptedValue;
  const oldDisplayText = atom.displayText;
  content.atoms[idx] = {
    ...atom,
    acceptedValue: value as typeof atom.acceptedValue,
    displayText,
  };

  return {
    content,
    inverse: {
      type: "apply-formula-result",
      atomId,
      value: oldValue ?? { kind: "null" } as NonNullable<typeof oldValue>,
      displayText: oldDisplayText,
    },
    affected: [atomId],
    dirty: { start: { atomId, offset: 0 }, end: { atomId, offset: displayText.length } },
  };
}