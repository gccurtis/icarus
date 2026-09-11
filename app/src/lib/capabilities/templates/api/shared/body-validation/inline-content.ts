import { isStoredRowId } from "$representation/data/behavior/core/stored";
import {
  TEMPLATE_SLOT_DESCRIPTION_LIMIT,
  TEMPLATE_SLOT_NAME_LIMIT
} from "$capabilities/templates/api/shared/slot-validation";
import {
  validFormulaValue,
  validMarkLink
} from "$capabilities/templates/api/shared/body-validation/formula-values";
import {
  type Fields,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_MARKS,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validCanonicalText,
  validIdentifier,
  validInteger,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";

const markEndOf = (value: unknown): { atom: string; offset: number } | undefined => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["atom", "offset"]) ||
    !validIdentifier(value.atom) ||
    !validInteger(value.offset, 0, MAX_BLOCK_TEXT_LENGTH)
  ) {
    return undefined;
  }
  return { atom: value.atom, offset: value.offset };
};

/** What an atom puts on the block's display, which is what a mark is measured against. */
const atomDisplayOf = (atom: unknown): string | undefined => {
  if (!isRecord(atom)) return undefined;
  if (atom.kind === "literal") return isText(atom.text) ? atom.text : undefined;
  if (atom.kind === "formula") {
    return isText(atom.lastResolvedDisplay) ? atom.lastResolvedDisplay : undefined;
  }
  if (atom.kind === "template") return isText(atom.name) ? `{${atom.name}}` : undefined;
  return undefined;
};

const markPosition = (
  atoms: readonly unknown[],
  end: { atom: string; offset: number }
): number | undefined => {
  let position = 0;
  for (const atom of atoms) {
    if (!isRecord(atom) || !validIdentifier(atom.id)) return undefined;
    const display = atomDisplayOf(atom);
    if (!isText(display)) return undefined;
    if (atom.id === end.atom) return end.offset <= display.length ? position + end.offset : undefined;
    position += display.length;
  }
  return undefined;
};

export const validMarks = (value: unknown, atoms?: readonly unknown[]): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_MARKS &&
  value.every((mark) => {
    const from = isRecord(mark) ? markEndOf(mark.from) : undefined;
    const to = isRecord(mark) ? markEndOf(mark.to) : undefined;
    if (
      !isRecord(mark) ||
      !hasOnlyKeys(mark, ["id", "from", "to", "style", "link", "color", "background", "slot"]) ||
      !validIdentifier(mark.id) ||
      from === undefined ||
      to === undefined
    ) {
      return false;
    }
    if (atoms === undefined) {
      if (from.atom === to.atom && from.offset > to.offset) return false;
    } else {
      const fromPosition = markPosition(atoms, from);
      const toPosition = markPosition(atoms, to);
      if (fromPosition === undefined || toPosition === undefined || fromPosition > toPosition) {
        return false;
      }
    }
    if (
      mark.style !== undefined &&
      (!Array.isArray(mark.style) ||
        mark.style.length > 5 ||
        new Set(mark.style).size !== mark.style.length ||
        !mark.style.every((style) =>
          ["bold", "italic", "underline", "strikethrough", "code"].includes(style)
        ))
    ) {
      return false;
    }
    return (
      (mark.link === undefined || validMarkLink(mark.link)) &&
      (mark.color === undefined || validText(mark.color, 1_000)) &&
      (mark.background === undefined || validText(mark.background, 1_000)) &&
      (mark.slot === undefined || validPromptSlot(mark.slot))
    );
  });

export const validAtom = (value: unknown): boolean => {
  if (!isRecord(value) || !validIdentifier(value.id)) return false;
  if (value.kind === "literal") {
    return (
      hasOnlyKeys(value, ["id", "kind", "text"]) &&
      validText(value.text, MAX_BLOCK_TEXT_LENGTH, true)
    );
  }
  if (value.kind === "template") {
    return (
      hasOnlyKeys(value, ["id", "kind", "name", "description", "text"]) &&
      validCanonicalText(value.name, TEMPLATE_SLOT_NAME_LIMIT) &&
      (value.description === undefined ||
        (isText(value.description) &&
          value.description.length <= TEMPLATE_SLOT_DESCRIPTION_LIMIT &&
          value.description === value.description.trim())) &&
      (value.text === undefined || validText(value.text, MAX_BLOCK_TEXT_LENGTH, true))
    );
  }
  return (
    value.kind === "formula" &&
    hasOnlyKeys(value, [
      "id",
      "kind",
      "expression",
      "formulaId",
      "lastResolvedValue",
      "lastResolvedDisplay",
      "state"
    ]) &&
    validText(value.expression, 10_000) &&
    (value.formulaId === undefined || isStoredRowId(value.formulaId, "formulas")) &&
    validFormulaValue(value.lastResolvedValue) &&
    validText(value.lastResolvedDisplay, MAX_BLOCK_TEXT_LENGTH, true) &&
    value.state === "fresh"
  );
};

export const displayOfAtoms = (atoms: readonly unknown[]): string =>
  atoms.map((atom) => atomDisplayOf(atom) ?? "").join("");

/** What a prompt says its slot is called, before the slot itself is declared. */
export const validPromptSlot = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["name", "description"]) &&
  validCanonicalText(value.name, TEMPLATE_SLOT_NAME_LIMIT) &&
  (value.description === undefined ||
    (isText(value.description) &&
      value.description.length <= TEMPLATE_SLOT_DESCRIPTION_LIMIT &&
      value.description === value.description.trim()));
