import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { cellKey, refuse, type Fields } from "$representation/data/behavior/spreadsheets/editing";

/**
 * A change set with its history derived rather than taken.
 *
 * What a set op replaced, what a remove op carried away, and where a moved track
 * sat are the whole of undo. A client can compute them, but it can also lie about
 * them, and a lie is only found when somebody presses undo and the sheet becomes
 * something nobody typed. So they are worked out here, against the sheet the
 * server holds, and the client's versions are dropped.
 */
export type Canonical = {
  readonly ops: readonly SpreadsheetOp[];
  readonly touched: readonly string[];
};

const readDeep = (held: unknown, fields: readonly string[]): unknown => {
  let at: unknown = held;
  for (const field of fields) {
    if (at === null || at === undefined || typeof at !== "object") return null;
    at = (at as Fields)[field];
  }
  return at ?? null;
};

/** What the sheet holds at an op's path right now. */
const priorValue = (sheet: LiveSheet, op: SpreadsheetOp): unknown => {
  const parts = op.path.split("/");
  switch (op.target) {
    case "cell": {
      const [rowId, columnId, ...rest] = parts;
      return readDeep(sheet.cells[cellKey(rowId, columnId)], rest);
    }
    case "mark": {
      const [rowId, columnId, , markId, ...rest] = parts;
      const marks = sheet.cells[cellKey(rowId, columnId)]?.marks ?? [];
      return readDeep(
        marks.find((mark) => mark.id === markId),
        rest
      );
    }
    case "formatRule": {
      const [, id, ...rest] = parts;
      return readDeep(
        sheet.body.formatRules.find((rule) => rule.id === id),
        rest
      );
    }
    case "sheet":
      return readDeep(sheet.body, parts);
    default:
      return null;
  }
};

/** What a remove op is carrying away, so its inverse can put it back. */
const priorValues = (sheet: LiveSheet, op: Extract<SpreadsheetOp, { op: "remove" }>): unknown[] => {
  const wanted = new Set(op.ids);
  switch (op.target) {
    case "gridRow":
      return sheet.body.rows
        .filter((row) => wanted.has(row.id))
        .map((row) => ({
          ...row,
          cells: Object.values(sheet.cells).filter((cell) => cell.rowId === row.id)
        }));
    case "gridColumn":
      return sheet.body.columns
        .filter((column) => wanted.has(column.id))
        .map((column) => ({
          ...column,
          cells: Object.values(sheet.cells).filter((cell) => cell.columnId === column.id)
        }));
    case "formatRule":
      return sheet.body.formatRules.filter((rule) => wanted.has(rule.id));
    case "mark": {
      const [rowId, columnId] = op.path.split("/");
      const marks = sheet.cells[cellKey(rowId, columnId)]?.marks ?? [];
      return marks.filter((mark) => wanted.has(mark.id));
    }
    case "sheet":
      return op.ids.map((key) => sheet.body.styles.styles[key]).filter((style) => style !== undefined);
    default:
      return [];
  }
};

/** Where a track sits now, named by what is in front of it. */
const priorAfter = (sheet: LiveSheet, op: Extract<SpreadsheetOp, { op: "move" }>): string | null => {
  const list = op.target === "gridRow" ? sheet.body.rows : sheet.body.columns;
  const at = list.findIndex((item) => item.id === op.id);
  if (at === -1) refuse(op, `no ${op.id} to move`);
  return at === 0 ? null : list[at - 1].id;
};

const canonicalOne = (sheet: LiveSheet, op: SpreadsheetOp): SpreadsheetOp => {
  switch (op.op) {
    case "set":
      return { ...op, was: priorValue(sheet, op) };
    case "remove":
      return { ...op, values: priorValues(sheet, op) };
    case "move":
      return { ...op, wasAfter: priorAfter(sheet, op) };
    case "insert":
      return op;
  }
};

/**
 * Every op with its history worked out against the sheet, and the paths they
 * reach. Each is derived from the state the one before it left, so a set and a
 * later set of the same field both invert correctly.
 */
export const canonicalOf = (sheet: LiveSheet, ops: readonly SpreadsheetOp[]): Canonical => {
  const canonical: SpreadsheetOp[] = [];
  let held = sheet;
  for (const op of ops) {
    const one = canonicalOne(held, op);
    canonical.push(one);
    held = applyOps(held, [one]);
  }
  // What was read is still the sheet's own objects, and two ops may have read
  // the same one. The store keeps a tree, so the history leaves as a copy.
  return {
    ops: JSON.parse(JSON.stringify(canonical)) as SpreadsheetOp[],
    touched: [...new Set(canonical.map((op) => op.path))]
  };
};
