import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export const frozenColumnsSet = (
  body: SpreadsheetBody,
  count: number
): SpreadsheetOp | undefined => {
  const next = Math.max(0, Math.min(Math.round(count), body.columns.length));
  if ((body.frozenColumns ?? 0) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: "frozenColumns",
    value: next === 0 ? null : next,
    was: body.frozenColumns ?? null
  };
};

export const frozenRowsSet = (
  body: SpreadsheetBody,
  count: number
): SpreadsheetOp | undefined => {
  const next = Math.max(0, Math.min(Math.round(count), body.rows.length));
  if ((body.frozenRows ?? 0) === next) return undefined;
  return {
    op: "set",
    target: "sheet",
    path: "frozenRows",
    value: next === 0 ? null : next,
    was: body.frozenRows ?? null
  };
};
