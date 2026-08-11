import type {
  FormulaAtom,
  FormulaAuthoringResult,
  RichContent,
  RichTextIdFactory,
  TextRange,
} from "./types.js";

/**
 * Convert one completed {{ ... }} range into a Formula atom operation.
 *
 * Formula source is extracted from canonical Rich Content. The helper does
 * not parse or normalize that source; those responsibilities belong to the
 * Formula platform. V1 deliberately accepts a range within one TextAtom,
 * which is the shape produced while a user types the closing delimiter.
 */
export function formulaFromDelimitedRange(
  content: RichContent,
  range: TextRange,
  ids: RichTextIdFactory,
): FormulaAuthoringResult {
  if (range.start.atomId !== range.end.atomId) {
    throw new Error("Formula delimiter range must be within one text atom");
  }

  const atom = content.atoms.find((candidate) => candidate.id === range.start.atomId);
  if (!atom) {
    throw new Error(`Atom not found: ${range.start.atomId}`);
  }
  if (atom.kind !== "text") {
    throw new Error(`Formula delimiter range requires a text atom, got: ${atom.kind}`);
  }

  const { start, end } = range;
  if (
    !Number.isInteger(start.offset) ||
    !Number.isInteger(end.offset) ||
    start.offset < 0 ||
    end.offset <= start.offset ||
    end.offset > atom.text.length
  ) {
    throw new Error("Formula delimiter range is out of bounds or empty");
  }

  const expectedText = atom.text.slice(start.offset, end.offset);
  if (!expectedText.startsWith("{{") || !expectedText.endsWith("}}")) {
    throw new Error("Formula delimiter range must start with '{{' and end with '}}'");
  }

  const expression = expectedText.slice(2, -2);
  if (expression.trim().length === 0) {
    throw new Error("Formula delimiter range must contain a non-blank expression");
  }

  const formulaAtom: FormulaAtom = {
    id: ids.atomId(),
    kind: "formula",
    expression,
    displayText: expectedText,
  };

  const hasLeadingText = start.offset > 0;
  const hasTrailingText = end.offset < atom.text.length;
  const trailingTextAtomId = hasLeadingText && hasTrailingText
    ? ids.atomId()
    : undefined;

  return {
    atomId: formulaAtom.id,
    expression,
    operations: [{
      type: "replace-range-with-atom",
      range,
      expectedText,
      atom: formulaAtom,
      ...(trailingTextAtomId ? { trailingTextAtomId } : {}),
    }],
  };
}
