import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  indexOf,
  labelOf,
  type CellRef,
  type Grid
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { displayOf, rawOf } from "$app-views/categories/spreadsheet-editor/procedures/values";

export type Hit = {
  readonly id: string;
  readonly ref: CellRef;
  readonly label: string;
  readonly text: string;
  readonly from: number;
  readonly to: number;
  readonly before: string;
  readonly match: string;
  readonly after: string;
  readonly inExpression: boolean;
};

const CONTEXT = 18;

const textOf = (sheet: LiveSheet, key: string): { text: string; inExpression: boolean } => {
  const held = sheet.cells[key];
  if (held?.expression !== undefined) return { text: held.expression, inExpression: true };
  return { text: displayOf(held?.value), inExpression: false };
};

export const hitsOf = (sheet: LiveSheet, grid: Grid, query: string, matchCase: boolean): Hit[] => {
  if (query.length === 0) return [];
  const needle = matchCase ? query : query.toLowerCase();
  const hits: Hit[] = [];

  for (const cell of Object.values(sheet.cells)) {
    const ref = { rowId: cell.rowId, columnId: cell.columnId };
    if (indexOf(grid, ref) === undefined) continue;
    const key = `${cell.rowId}/${cell.columnId}`;
    const { text, inExpression } = textOf(sheet, key);
    const haystack = matchCase ? text : text.toLowerCase();
    const label = labelOf(grid, ref);
    let from = haystack.indexOf(needle);

    while (from !== -1) {
      const to = from + query.length;
      hits.push({
        id: `${key}@${from}`,
        ref,
        label,
        text,
        from,
        to,
        before: text.slice(Math.max(0, from - CONTEXT), from),
        match: text.slice(from, to),
        after: text.slice(to, to + CONTEXT),
        inExpression
      });
      from = haystack.indexOf(needle, from + Math.max(1, query.length));
    }
  }

  return hits.sort((a, b) => {
    const left = indexOf(grid, a.ref);
    const right = indexOf(grid, b.ref);
    return (left?.row ?? 0) - (right?.row ?? 0) || (left?.column ?? 0) - (right?.column ?? 0) || a.from - b.from;
  });
};

const replacedText = (sheet: LiveSheet, hits: readonly Hit[], replacement: string): string => {
  const [first] = hits;
  const key = `${first.ref.rowId}/${first.ref.columnId}`;
  const held = sheet.cells[key];
  const text = held?.expression ?? rawOf(held);
  const shown = textOf(sheet, key).text;
  if (text !== shown) return text;
  let out = "";
  let cursor = 0;
  for (const hit of [...hits].sort((a, b) => a.from - b.from)) {
    out += text.slice(cursor, hit.from) + replacement;
    cursor = hit.to;
  }
  return out + text.slice(cursor);
};

const byCell = (hits: readonly Hit[]): Map<string, Hit[]> => {
  const groups = new Map<string, Hit[]>();
  for (const hit of hits) {
    const key = `${hit.ref.rowId}/${hit.ref.columnId}`;
    groups.set(key, [...(groups.get(key) ?? []), hit]);
  }
  return groups;
};

export const replaceOps = (sheet: LiveSheet, grid: Grid, hits: readonly Hit[], replacement: string): SpreadsheetOp[] => {
  const ops: SpreadsheetOp[] = [];
  for (const group of byCell(hits).values()) {
    const next = replacedText(sheet, group, replacement);
    const edit = typed(sheet, grid, group[0].ref, next);
    if (edit.refused === undefined) ops.push(...edit.ops);
  }
  return ops;
};
