// How a settled Formula value appears inline in Rich Text.
//
// Rich Text owns the formula atom and its `displayText`; Document is only the
// host that computes that text when it settles an evaluation. Most values have a
// sensible one-line form and Formula itself produces it.
//
// A chart does not. It is a table carrying rendering intent, and formatting it
// inline would drop a whole result set into the middle of a sentence. Those get
// a signifier instead: the value is still stored intact on the atom, and a host
// that can actually draw one is expected to replace the *Block* rather than
// render this text.

import { formatFormulaValue } from "#formula";
import type { FormulaValue } from "#formula";

/** Stands in for a value that has no meaningful inline rendering. */
export const NON_RENDERING_DISPLAY_TEXT = "UNKNOWN";

/**
 * True when a value carries rendering intent — that is, when DISPLAY set a chart
 * kind on it. Such a value is a chart, not a number or a piece of text.
 */
export const hasRenderingIntent = (value: FormulaValue): boolean =>
  value.kind === "table" && value.display !== undefined;

/**
 * The inline text for a settled formula value. The accepted value itself is
 * never altered — only how it reads in a line of prose.
 */
export const formulaAtomDisplayText = (value: FormulaValue): string =>
  hasRenderingIntent(value) ? NON_RENDERING_DISPLAY_TEXT : formatFormulaValue(value);
