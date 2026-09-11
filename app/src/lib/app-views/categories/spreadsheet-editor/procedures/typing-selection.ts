import type { Selection } from "$representation/data/types/workspace/tab";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { keyOf, refOfKey, refsIn, type CellRef, type Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { typed, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import type { SheetFacts } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { selectedRects } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";

/** The initial cell stays the anchor even when a range was dragged backwards. */
export const writingAnchor = (selection: Selection | undefined): CellRef | undefined =>
  selection?.kind === "cell" || selection?.kind === "range" ? refOfKey(selection.id) : undefined;

export const writingTargets = (grid: Grid, selection: Selection | undefined): CellRef[] => {
  const refs = selectedRects(grid, selection).flatMap((rect) => refsIn(grid, rect));
  return [...new Map(refs.map((ref) => [keyOf(ref), ref])).values()];
};

/** One submitted value/expression, one undoable operation, no partial range writes. */
export const typedSelection = (
  sheet: LiveSheet,
  grid: Grid,
  targets: readonly CellRef[],
  text: string,
  facts: SheetFacts
): Edit => {
  const edits = targets.map((ref) => typed(sheet, grid, ref, text, facts));
  const refusal = edits.find((edit) => edit.refused !== undefined)?.refused;
  return refusal === undefined
    ? { ops: edits.flatMap((edit) => edit.ops) }
    : { ops: [], refused: refusal };
};
