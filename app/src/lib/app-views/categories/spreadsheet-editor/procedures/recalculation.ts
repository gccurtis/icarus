import {
  recalculated,
  sourceOf,
  withRecalculation,
  type SheetSource,
  type Surroundings
} from "$representation/data/behavior/spreadsheets/formulas";
import {
  toShown,
  toStored,
  type SheetFacts,
  type Translated
} from "$representation/data/behavior/spreadsheets/translation";
import type { Id } from "$representation/data/types/core/id";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { literalOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
import { variableValue } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

export type { SheetFacts, SheetSource, Surroundings, Translated };
export type { SheetCell } from "$representation/data/types/spreadsheets/cell";
export { recalculated, sourceOf, toShown, toStored, withRecalculation };

/** The sheet a view is looking at, named the way a view names one. */
export const sourceFor = (resourceId: string | undefined, sheet: LiveSheet): SheetSource =>
  sourceOf((resourceId ?? "") as Id<"spreadsheets">, sheet);

/**
 * What a formula in this editor can reach beyond its own sheet: the project's
 * names. Another sheet is reachable only where one has been handed over, and a
 * formula that names one the reader cannot see is left alone rather than broken.
 */
export const AROUND: Surroundings = { variable: variableValue };

export const factsOf = (
  resourceId: string | undefined,
  sheet: LiveSheet | undefined,
  title = ""
): SheetFacts => ({
  resourceId: (resourceId ?? "") as Id<"spreadsheets">,
  title,
  grid: gridOf(sheet?.body)
});

/** What a person reads: the stored formula, drawn as addresses in this sheet. */
export const shownOf = (
  facts: SheetFacts,
  cell: SheetCell | undefined,
  byId?: (id: string) => SheetFacts | undefined
): string =>
  cell?.expression === undefined
    ? ""
    : toShown(cell.expression, facts, { byId, anchors: cell.anchors });

/** What a lens puts in an editable box: the drawn formula, or the literal value. */
export const editableOf = (
  facts: SheetFacts,
  cell: SheetCell | undefined,
  byId?: (id: string) => SheetFacts | undefined
): string => (cell?.expression === undefined ? literalOf(cell?.value) : shownOf(facts, cell, byId));

/** What a person typed, turned into the formula that gets stored. */
export const storedOf = (
  facts: SheetFacts,
  text: string,
  byTitle?: (title: string) => SheetFacts | undefined
): Translated => toStored(text, facts, byTitle);

/**
 * An edit and everything it changes, for a sheet the editor is holding open.
 */
export const recalculating = (
  resourceId: string | undefined,
  sheet: LiveSheet,
  ops: readonly SpreadsheetOp[],
  around: Surroundings = AROUND
): SpreadsheetOp[] =>
  withRecalculation(sourceOf((resourceId ?? "") as Id<"spreadsheets">, sheet), ops, around);
