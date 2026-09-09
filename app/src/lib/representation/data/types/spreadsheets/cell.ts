import type { Mark } from "$representation/data/types/content/content-block";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { Id } from "$representation/data/types/core/id";
import type { Refusal } from "$representation/data/types/formulas/refusal";
import type { CellFormat } from "$representation/data/types/spreadsheets/cell-format";

/**
 * One populated cell.
 *
 * `expression` is the formula, addressed by id: never `=E4*60/C4`, always the
 * cells themselves. The sheet turns what a person typed into this on the way in
 * and draws it back as `E4` on the way out, so inserting a row above changes
 * what is shown and never what is stored. `formulaId` names the row in
 * `formulas` holding the same text for the rest of the project to read.
 *
 * `anchors` is the sheet's own bookkeeping, one mask per reference in the order
 * they appear: which half of an address copy and paste holds still. It is beside
 * the formula rather than in it, so a locked and an unlocked reference to the
 * same cell are the same formula.
 *
 * A refused formula keeps `empty` as its value and says why in `failure`, which
 * is why there is no error kind: a failure belongs to the holder, and this is
 * the holder.
 */
export type SheetCell = {
  rowId: string;
  columnId: string;
  value: VariableValue;
  expression?: string;
  anchors?: string[];
  formulaId?: Id<"formulas">;
  failure?: Refusal;
  marks?: Mark[];
  format?: CellFormat;
  mergedTo?: CellRef;
  spillTo?: CellRef;
};
