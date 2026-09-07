import { addressText, addressesIn } from "$representation/data/behavior/formulas/addresses";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  contains,
  indexOf,
  keyOf,
  rectOf,
  refsIn,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { toShown, type SheetFacts } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { ERRORS, errorOf, type ErrorToken } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Reference = {
  readonly text: string;
  readonly kind: "cell" | "range" | "external" | "broken";
  readonly rect?: Rect;
  readonly sheet?: string;
  readonly address?: string;
};

/**
 * What one cell's formula points at, read off the ids it stores rather than
 * scanned out of its text. A reference that names another sheet is `external`
 * and carries that sheet's id; one whose ids are gone is `broken`.
 */
export const referencesIn = (
  facts: SheetFacts,
  cell: SheetCell | undefined,
  byId?: (id: string) => SheetFacts | undefined
): Reference[] => {
  if (cell?.expression === undefined) return [];
  const found: Reference[] = [];
  const seen = new Set<string>();

  addressesIn(cell.expression).forEach((address, index) => {
    if (address.at === "resource") {
      const reference: Reference = { text: address.ref.id, kind: "external", sheet: address.ref.id };
      if (!seen.has(reference.text)) {
        seen.add(reference.text);
        found.push(reference);
      }
      return;
    }

    const drawn = toShown(addressText(address), facts, {
      byId,
      anchors: [(cell.anchors ?? [])[index] ?? ""]
    });

    if (address.resourceId !== facts.resourceId) {
      const reference: Reference = {
        text: drawn,
        kind: "external",
        sheet: address.resourceId,
        address: drawn.includes("!") ? drawn.slice(drawn.indexOf("!") + 1) : drawn
      };
      if (seen.has(reference.text)) return;
      seen.add(reference.text);
      found.push(reference);
      return;
    }

    const range = address.at === "cell" ? { from: address.cell, to: address.cell } : address.range;
    const rect = rectOf(facts.grid, range);
    const reference: Reference =
      rect === undefined
        ? { text: drawn, kind: "broken" }
        : { text: drawn, kind: address.at === "range" ? "range" : "cell", rect };
    if (seen.has(reference.text)) return;
    seen.add(reference.text);
    found.push(reference);
  });
  return found;
};

export type Dependency = { readonly ref: CellRef; readonly cell: SheetCell | undefined };

export const sheetNamed = <T extends { readonly title: string }>(sheets: readonly T[], name: string): T | undefined => {
  const wanted = name.trim().toLowerCase();
  return sheets.find((sheet) => sheet.title.trim().toLowerCase() === wanted);
};

const CAP = 200;

/** Every cell this one reads, in this sheet. */
export const precedentsOf = (sheet: LiveSheet, facts: SheetFacts, ref: CellRef): Dependency[] => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.expression === undefined) return [];
  const refs: Dependency[] = [];
  const seen = new Set<string>();

  for (const address of addressesIn(held.expression)) {
    if (address.at === "resource" || address.resourceId !== facts.resourceId) continue;
    const range = address.at === "cell" ? { from: address.cell, to: address.cell } : address.range;
    const rect = rectOf(facts.grid, range);
    if (rect === undefined) continue;
    for (const target of refsIn(facts.grid, rect)) {
      const key = keyOf(target);
      if (seen.has(key) || key === keyOf(ref)) continue;
      seen.add(key);
      refs.push({ ref: target, cell: sheet.cells[key] });
      if (refs.length >= CAP) return refs;
    }
  }
  return refs;
};

/** Every cell that reads this one. */
export const dependentsOf = (sheet: LiveSheet, facts: SheetFacts, ref: CellRef): Dependency[] => {
  const at = indexOf(facts.grid, ref);
  if (at === undefined) return [];

  const reads = (cell: SheetCell): boolean =>
    addressesIn(cell.expression ?? "").some((address) => {
      if (address.at === "resource" || address.resourceId !== facts.resourceId) return false;
      const range = address.at === "cell" ? { from: address.cell, to: address.cell } : address.range;
      const rect = rectOf(facts.grid, range);
      return rect !== undefined && contains(rect, at.row, at.column);
    });

  return Object.values(sheet.cells)
    .filter((cell) => cell.expression !== undefined && !(cell.rowId === ref.rowId && cell.columnId === ref.columnId))
    .filter(reads)
    .sort((a, b) => {
      const left = indexOf(facts.grid, { rowId: a.rowId, columnId: a.columnId });
      const right = indexOf(facts.grid, { rowId: b.rowId, columnId: b.columnId });
      return (left?.row ?? 0) - (right?.row ?? 0) || (left?.column ?? 0) - (right?.column ?? 0);
    })
    .map((cell) => ({ ref: { rowId: cell.rowId, columnId: cell.columnId }, cell }));
};

export type Problem = {
  readonly ref: CellRef;
  readonly cell: SheetCell;
  readonly error: string;
  readonly explanation: string;
};

/**
 * What a refusal means, in a sentence. `#NAME?` quotes the word the formula
 * could not place, which the refusal carried out of the engine rather than
 * anything having to guess at it.
 */
export const explanationOf = (cell: SheetCell | undefined): string => {
  const failure = cell?.failure;
  if (failure === undefined) return "";
  if (failure.token === "#NAME?" && failure.word !== undefined) {
    return `No name in this spreadsheet or this project is called ${failure.word}.`;
  }
  return ERRORS[failure.token as ErrorToken] ?? "This formula could not be evaluated.";
};

export const problemsOf = (sheet: LiveSheet, grid: Grid): Problem[] =>
  Object.values(sheet.cells)
    .flatMap((cell) => {
      const error = errorOf(cell);
      if (error === undefined) return [];
      const ref = { rowId: cell.rowId, columnId: cell.columnId };
      return [{ ref, cell, error, explanation: explanationOf(cell) }];
    })
    .sort((a, b) => {
      const left = indexOf(grid, a.ref);
      const right = indexOf(grid, b.ref);
      return (left?.row ?? 0) - (right?.row ?? 0) || (left?.column ?? 0) - (right?.column ?? 0);
    });
