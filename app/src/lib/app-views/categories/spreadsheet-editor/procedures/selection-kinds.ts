/**
 * What a selection can be about.
 *
 * A tab holds one selection and every panel in the category reads it, so the
 * words for its kinds are shared rather than repeated as literals. They are the
 * same strings the workspace stores, which is why they are constants and not an
 * enum: the value on the wire is the value here.
 */
export const CELL = "cell";
export const RANGE = "range";
export const ROW = "row";
export const COLUMN = "column";
export const STYLE = "named-style";
export const TEXT = "text-selection";
export const COMMENT = "comment";
export const VARIABLE = "variable";
