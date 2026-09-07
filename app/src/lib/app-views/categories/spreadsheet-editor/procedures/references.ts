import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import {
  contains,
  indexOf,
  keyOf,
  parseRange,
  refsIn,
  type CellRef,
  type Grid,
  type Rect
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { ERRORS, errorOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Reference = {
  readonly text: string;
  readonly kind: "cell" | "range" | "external" | "name" | "broken";
  readonly rect?: Rect;
  readonly sheet?: string;
  readonly address?: string;
};

const TOKEN =
  /"[^"]*"|(#REF!)|(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(])|([A-Za-z_][A-Za-z0-9_.]*)/g;

const RESERVED = new Set(["TRUE", "FALSE"]);

export const referencesIn = (grid: Grid, expression: string): Reference[] => {
  const found: Reference[] = [];
  const seen = new Set<string>();
  const body = expression.startsWith("=") ? expression.slice(1) : expression;

  for (const match of body.matchAll(TOKEN)) {
    const [whole, broken, quotedSheet, bareSheet, external, local, name] = match;
    if (whole.startsWith('"')) continue;
    const after = body.slice((match.index ?? 0) + whole.length);
    const sheetName = quotedSheet ?? bareSheet;
    let reference: Reference | undefined;

    if (broken !== undefined) reference = { text: broken, kind: "broken" };
    else if (sheetName !== undefined && external !== undefined) {
      reference = { text: whole, kind: "external", sheet: sheetName, address: external.replace(/\$/g, "") };
    } else if (local !== undefined) {
      const range = parseRange(grid, local.replace(/\$/g, ""));
      const rect = range === undefined ? undefined : rectOfRange(grid, range);
      reference =
        rect === undefined
          ? { text: local, kind: "broken" }
          : { text: local, kind: local.includes(":") ? "range" : "cell", rect };
    } else if (name !== undefined) {
      if (/^\s*\(/.test(after) || RESERVED.has(name.toUpperCase())) continue;
      reference = { text: name, kind: "name" };
    }

    if (reference === undefined || seen.has(reference.text)) continue;
    seen.add(reference.text);
    found.push(reference);
  }
  return found;
};

const rectOfRange = (grid: Grid, range: { from: CellRef; to: CellRef }): Rect | undefined => {
  const from = indexOf(grid, range.from);
  const to = indexOf(grid, range.to);
  if (from === undefined || to === undefined) return undefined;
  return {
    row: Math.min(from.row, to.row),
    column: Math.min(from.column, to.column),
    rows: Math.abs(from.row - to.row) + 1,
    columns: Math.abs(from.column - to.column) + 1
  };
};

export type Dependency = { readonly ref: CellRef; readonly cell: SheetCell | undefined };

export const sheetNamed = <T extends { readonly title: string }>(sheets: readonly T[], name: string): T | undefined => {
  const wanted = name.trim().toLowerCase();
  return sheets.find((sheet) => sheet.title.trim().toLowerCase() === wanted);
};

const CAP = 200;

export const precedentsOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Dependency[] => {
  const held = sheet.cells[keyOf(ref)];
  if (held?.expression === undefined) return [];
  const refs: Dependency[] = [];
  const seen = new Set<string>();
  for (const reference of referencesIn(grid, held.expression)) {
    if (reference.rect === undefined) continue;
    for (const target of refsIn(grid, reference.rect)) {
      const key = keyOf(target);
      if (seen.has(key) || key === keyOf(ref)) continue;
      seen.add(key);
      refs.push({ ref: target, cell: sheet.cells[key] });
      if (refs.length >= CAP) return refs;
    }
  }
  return refs;
};

export const dependentsOf = (sheet: LiveSheet, grid: Grid, ref: CellRef): Dependency[] => {
  const at = indexOf(grid, ref);
  if (at === undefined) return [];
  return Object.values(sheet.cells)
    .filter((cell) => cell.expression !== undefined && !(cell.rowId === ref.rowId && cell.columnId === ref.columnId))
    .filter((cell) =>
      referencesIn(grid, cell.expression ?? "").some(
        (reference) => reference.rect !== undefined && contains(reference.rect, at.row, at.column)
      )
    )
    .sort((a, b) => {
      const left = indexOf(grid, { rowId: a.rowId, columnId: a.columnId });
      const right = indexOf(grid, { rowId: b.rowId, columnId: b.columnId });
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

export const explanationOf = (grid: Grid, error: string, expression: string | undefined): string => {
  if (error === "#NAME?" && expression !== undefined) {
    const name = referencesIn(grid, expression).find((reference) => reference.kind === "name");
    if (name !== undefined) return `No name in this spreadsheet or this project is called ${name.text}.`;
  }
  return ERRORS[error] ?? "This formula could not be evaluated.";
};

export const problemsOf = (sheet: LiveSheet, grid: Grid): Problem[] =>
  Object.values(sheet.cells)
    .flatMap((cell) => {
      const error = errorOf(cell.value);
      if (error === undefined) return [];
      const ref = { rowId: cell.rowId, columnId: cell.columnId };
      return [{ ref, cell, error, explanation: explanationOf(grid, error, cell.expression) }];
    })
    .sort((a, b) => {
      const left = indexOf(grid, a.ref);
      const right = indexOf(grid, b.ref);
      return (left?.row ?? 0) - (right?.row ?? 0) || (left?.column ?? 0) - (right?.column ?? 0);
    });
