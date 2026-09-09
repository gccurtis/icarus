import type {
  GridColumn,
  GridRow,
  SpreadsheetBody
} from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export type Fields = Record<string, unknown>;
export type SetOp = Extract<SpreadsheetOp, { op: "set" }>;
export type InsertOp = Extract<SpreadsheetOp, { op: "insert" }>;
export type RemoveOp = Extract<SpreadsheetOp, { op: "remove" }>;
export type MoveOp = Extract<SpreadsheetOp, { op: "move" }>;
export type ListOp = InsertOp | RemoveOp;
export type Ordered = { id: string; order: number };

export type CarriedRow = GridRow & { cells?: SheetCell[] };
export type CarriedColumn = GridColumn & { cells?: SheetCell[] };

export const cellKey = (rowId: string, columnId: string): string => `${rowId}/${columnId}`;

export const splitCellKey = (key: string): { rowId: string; columnId: string } | undefined => {
  const [rowId, columnId, ...rest] = key.split("/");
  if (!rowId || !columnId || rest.length > 0) return undefined;
  return { rowId, columnId };
};

export const refuse = (op: SpreadsheetOp, why: string): never => {
  throw new Error(`cannot apply ${op.op} on ${op.target} at ${op.path}: ${why}`);
};

export const withField = <T extends object>(held: T, field: string, value: unknown): T => {
  if (value === null) {
    const { [field]: gone, ...rest } = held as Fields;
    void gone;
    return rest as T;
  }
  return { ...held, [field]: value };
};

export const setDeep = (held: unknown, fields: readonly string[], value: unknown): unknown => {
  const [field, ...rest] = fields;
  if (field === undefined) return value;
  const object = held !== null && typeof held === "object" ? (held as Fields) : {};
  return withField(object, field, rest.length === 0 ? value : setDeep(object[field], rest, value));
};

export const insertAfter = <T extends { id: string }>(
  items: readonly T[],
  after: string | null,
  values: readonly T[],
  op: SpreadsheetOp
): T[] => {
  if (after === null) return [...values, ...items];
  const at = items.findIndex((item) => item.id === after);
  if (at === -1) refuse(op, `nothing with id ${after} to insert after`);
  return [...items.slice(0, at + 1), ...values, ...items.slice(at + 1)];
};

export const withoutIds = <T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
  op: SpreadsheetOp
): T[] => {
  const going = new Set(ids);
  const kept = items.filter((item) => !going.has(item.id));
  if (kept.length + going.size !== items.length) {
    refuse(op, `not every id of ${ids.join(", ")} is there to remove`);
  }
  return kept;
};

const midpoint = (before: number | undefined, after: number | undefined): number => {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
};

export const reordered = <T extends Ordered>(items: readonly T[], fresh: ReadonlySet<string>): T[] =>
  items.map((item, index) =>
    fresh.has(item.id)
      ? { ...item, order: midpoint(items[index - 1]?.order, items[index + 1]?.order) }
      : item
  );

export const isValue = (value: unknown): boolean =>
  value !== null && typeof value === "object" && typeof (value as Fields).kind === "string";

export const hasRow = (body: SpreadsheetBody, id: string): boolean =>
  body.rows.some((row) => row.id === id);

export const hasColumn = (body: SpreadsheetBody, id: string): boolean =>
  body.columns.some((column) => column.id === id);

export const withCell = (sheet: LiveSheet, key: string, cell: SheetCell): LiveSheet => ({
  ...sheet,
  cells: { ...sheet.cells, [key]: cell }
});

export const withBody = (sheet: LiveSheet, body: SpreadsheetBody): LiveSheet => ({ ...sheet, body });
