import type { Mark } from "$representation/data/types/content/content-block";
import type {
  FormatRule,
  GridColumn,
  GridRow,
  SheetPrint,
  SpreadsheetBody
} from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { TextStyle } from "$representation/data/types/spreadsheets/style-set";

type Fields = Record<string, unknown>;
type SetOp = Extract<SpreadsheetOp, { op: "set" }>;
type InsertOp = Extract<SpreadsheetOp, { op: "insert" }>;
type RemoveOp = Extract<SpreadsheetOp, { op: "remove" }>;
type MoveOp = Extract<SpreadsheetOp, { op: "move" }>;
type ListOp = InsertOp | RemoveOp;
type Ordered = { id: string; order: number };

export type CarriedRow = GridRow & { cells?: SheetCell[] };
export type CarriedColumn = GridColumn & { cells?: SheetCell[] };

export const cellKey = (rowId: string, columnId: string): string => `${rowId}/${columnId}`;

export const splitCellKey = (key: string): { rowId: string; columnId: string } | undefined => {
  const [rowId, columnId, ...rest] = key.split("/");
  if (!rowId || !columnId || rest.length > 0) return undefined;
  return { rowId, columnId };
};

const refuse = (op: SpreadsheetOp, why: string): never => {
  throw new Error(`cannot apply ${op.op} on ${op.target} at ${op.path}: ${why}`);
};

const withField = <T extends object>(held: T, field: string, value: unknown): T => {
  if (value === null) {
    const { [field]: gone, ...rest } = held as Fields;
    void gone;
    return rest as T;
  }
  return { ...held, [field]: value };
};

const setDeep = (held: unknown, fields: readonly string[], value: unknown): unknown => {
  const [field, ...rest] = fields;
  if (field === undefined) return value;
  const object = held !== null && typeof held === "object" ? (held as Fields) : {};
  return withField(object, field, rest.length === 0 ? value : setDeep(object[field], rest, value));
};

const insertAfter = <T extends { id: string }>(
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

const withoutIds = <T extends { id: string }>(
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

const reordered = <T extends Ordered>(items: readonly T[], fresh: ReadonlySet<string>): T[] =>
  items.map((item, index) =>
    fresh.has(item.id)
      ? { ...item, order: midpoint(items[index - 1]?.order, items[index + 1]?.order) }
      : item
  );

const isValue = (value: unknown): boolean =>
  value !== null && typeof value === "object" && typeof (value as Fields).kind === "string";

const hasRow = (body: SpreadsheetBody, id: string): boolean => body.rows.some((row) => row.id === id);
const hasColumn = (body: SpreadsheetBody, id: string): boolean =>
  body.columns.some((column) => column.id === id);

const withCell = (sheet: LiveSheet, key: string, cell: SheetCell): LiveSheet => ({
  ...sheet,
  cells: { ...sheet.cells, [key]: cell }
});

const withBody = (sheet: LiveSheet, body: SpreadsheetBody): LiveSheet => ({ ...sheet, body });

const cellAt = (sheet: LiveSheet, op: SpreadsheetOp) => {
  const [rowId, columnId, ...rest] = op.path.split("/");
  if (!rowId || !columnId) refuse(op, "a cell path is <rowId>/<columnId>[/<field>…]");
  if (!hasRow(sheet.body, rowId)) refuse(op, `no row ${rowId}`);
  if (!hasColumn(sheet.body, columnId)) refuse(op, `no column ${columnId}`);
  return { rowId, columnId, key: cellKey(rowId, columnId), rest };
};

const setCell = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const { rowId, columnId, key, rest } = cellAt(sheet, op);
  const held = sheet.cells[key];

  if (rest.length === 0) {
    if (op.value === null) {
      const { [key]: gone, ...kept } = sheet.cells;
      void gone;
      return { ...sheet, cells: kept };
    }
    if (typeof op.value !== "object") refuse(op, "a whole cell is an object");
    const fields = op.value as Partial<SheetCell>;
    if (!isValue(fields.value)) refuse(op, "a cell holds a value");
    return withCell(sheet, key, { ...fields, rowId, columnId } as SheetCell);
  }

  const [field] = rest;
  if (field === "rowId" || field === "columnId") {
    refuse(op, "a cell's address is where it sits, not a field of it");
  }
  if (field === "marks") refuse(op, "marks are inserted and removed by id");
  if (field === "value" && !isValue(op.value)) refuse(op, "a value has a kind");

  const base: SheetCell = held ?? { rowId, columnId, value: { kind: "empty" } };
  return withCell(sheet, key, setDeep(base, rest, op.value) as SheetCell);
};

const marksAt = (sheet: LiveSheet, op: SpreadsheetOp) => {
  const [rowId, columnId, word, ...rest] = op.path.split("/");
  if (!rowId || !columnId || word !== "marks") {
    refuse(op, "a mark path is <rowId>/<columnId>/marks[/<markId>/<field>]");
  }
  const key = cellKey(rowId, columnId);
  const held = sheet.cells[key];
  if (held === undefined) refuse(op, `no cell at ${key}`);
  return { key, held, marks: held.marks ?? [], rest };
};

const setMark = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const { key, held, marks, rest } = marksAt(sheet, op);
  const [markId, ...fields] = rest;
  if (!markId || fields.length === 0) refuse(op, "a mark is set one field at a time");
  const at = marks.findIndex((mark) => mark.id === markId);
  if (at === -1) refuse(op, `no mark ${markId}`);
  const next = marks.map((mark, index) =>
    index === at ? (setDeep(mark, fields, op.value) as Mark) : mark
  );
  return withCell(sheet, key, { ...held, marks: next });
};

const listMarks = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  const { key, held, marks, rest } = marksAt(sheet, op);
  if (rest.length > 0) refuse(op, "marks are inserted and removed at <rowId>/<columnId>/marks");
  const next =
    op.op === "insert"
      ? insertAfter(marks, op.after, op.values as Mark[], op)
      : withoutIds(marks, op.ids, op);
  return withCell(sheet, key, next.length === 0 ? withField(held, "marks", null) : { ...held, marks: next });
};

const setRule = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const [word, id, ...fields] = op.path.split("/");
  if (word !== "formatRules" || !id || fields.length === 0) {
    refuse(op, "a rule path is formatRules/<id>/<field…>");
  }
  const rules = sheet.body.formatRules;
  const at = rules.findIndex((rule) => rule.id === id);
  if (at === -1) refuse(op, `no rule ${id}`);
  const next = rules.map((rule, index) =>
    index === at ? (setDeep(rule, fields, op.value) as FormatRule) : rule
  );
  return withBody(sheet, { ...sheet.body, formatRules: next });
};

const listRules = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "formatRules") refuse(op, "rules are inserted and removed at formatRules");
  if (op.op === "insert") {
    const values = op.values as FormatRule[];
    if (values.length !== op.ids.length || values.some((rule, index) => rule.id !== op.ids[index])) {
      refuse(op, "ids and values disagree");
    }
    if (values.some((rule) => sheet.body.formatRules.some((held) => held.id === rule.id))) {
      refuse(op, "a rule with that id is already there");
    }
    return withBody(sheet, {
      ...sheet.body,
      formatRules: insertAfter(sheet.body.formatRules, op.after, values, op)
    });
  }
  return withBody(sheet, { ...sheet.body, formatRules: withoutIds(sheet.body.formatRules, op.ids, op) });
};

const listRows = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "rows") refuse(op, "rows are inserted and removed at rows");
  if (op.op === "insert") {
    const carried = op.values as CarriedRow[];
    if (carried.length !== op.ids.length || carried.some((row, index) => row.id !== op.ids[index])) {
      refuse(op, "ids and values disagree");
    }
    if (carried.some((row) => hasRow(sheet.body, row.id))) refuse(op, "a row with that id is already there");
    const bare = carried.map(({ cells: _cells, ...row }) => row);
    const rows = reordered(insertAfter(sheet.body.rows, op.after, bare, op), new Set(op.ids));
    const cells = { ...sheet.cells };
    for (const row of carried) {
      for (const cell of row.cells ?? []) cells[cellKey(row.id, cell.columnId)] = { ...cell, rowId: row.id };
    }
    return { body: { ...sheet.body, rows }, cells };
  }
  const rows = withoutIds(sheet.body.rows, op.ids, op);
  const going = new Set(op.ids);
  const cells = Object.fromEntries(
    Object.entries(sheet.cells).filter(([, cell]) => !going.has(cell.rowId))
  );
  return { body: { ...sheet.body, rows }, cells };
};

const listColumns = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "columns") refuse(op, "columns are inserted and removed at columns");
  if (op.op === "insert") {
    const carried = op.values as CarriedColumn[];
    if (carried.length !== op.ids.length || carried.some((column, index) => column.id !== op.ids[index])) {
      refuse(op, "ids and values disagree");
    }
    if (carried.some((column) => hasColumn(sheet.body, column.id))) {
      refuse(op, "a column with that id is already there");
    }
    const bare = carried.map(({ cells: _cells, ...column }) => column);
    const columns = reordered(insertAfter(sheet.body.columns, op.after, bare, op), new Set(op.ids));
    const cells = { ...sheet.cells };
    for (const column of carried) {
      for (const cell of column.cells ?? []) {
        cells[cellKey(cell.rowId, column.id)] = { ...cell, columnId: column.id };
      }
    }
    return { body: { ...sheet.body, columns }, cells };
  }
  const columns = withoutIds(sheet.body.columns, op.ids, op);
  const going = new Set(op.ids);
  const cells = Object.fromEntries(
    Object.entries(sheet.cells).filter(([, cell]) => !going.has(cell.columnId))
  );
  return { body: { ...sheet.body, columns }, cells };
};

const moved = <T extends Ordered>(items: readonly T[], op: MoveOp): T[] => {
  const held = items.find((item) => item.id === op.id);
  if (held === undefined) return refuse(op, `no ${op.id} to move`);
  const without = items.filter((item) => item.id !== op.id);
  const at = op.after === null ? 0 : without.findIndex((item) => item.id === op.after) + 1;
  if (op.after !== null && at === 0) refuse(op, `nothing with id ${op.after} to move after`);
  const placed: T[] = [...without.slice(0, at), held, ...without.slice(at)];
  return reordered(placed, new Set([op.id]));
};

const move = (sheet: LiveSheet, op: MoveOp): LiveSheet => {
  if (op.target === "gridRow") {
    if (op.path !== "rows") refuse(op, "rows move at rows");
    return withBody(sheet, { ...sheet.body, rows: moved(sheet.body.rows, op) });
  }
  if (op.path !== "columns") refuse(op, "columns move at columns");
  return withBody(sheet, { ...sheet.body, columns: moved(sheet.body.columns, op) });
};

const setSheet = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const [root, ...rest] = op.path.split("/");
  const body = sheet.body;

  if (root === "frozenRows" || root === "frozenColumns") {
    if (rest.length > 0) refuse(op, `${root} is one number`);
    if (op.value !== null && (typeof op.value !== "number" || !Number.isInteger(op.value) || op.value < 0)) {
      refuse(op, "a frozen count is a whole number");
    }
    return withBody(sheet, withField(body, root, op.value));
  }

  if (root === "print") {
    if (rest.length === 0 && (op.value === null || typeof op.value !== "object")) {
      refuse(op, "print is set whole as an object or by field");
    }
    return withBody(sheet, { ...body, print: setDeep(body.print, rest, op.value) as SheetPrint });
  }

  if (root === "styles") {
    const [which, key, ...fields] = rest;
    if (which === "defaultKey" && key === undefined) {
      const defaultKey = typeof op.value === "string" ? op.value : undefined;
      if (defaultKey === undefined || !(defaultKey in body.styles.styles)) {
        return refuse(op, "the default names a style that exists");
      }
      return withBody(sheet, { ...body, styles: { ...body.styles, defaultKey } });
    }
    if (which === "styles" && key !== undefined && fields.length > 0) {
      const held = body.styles.styles[key];
      if (held === undefined) refuse(op, `no style ${key}`);
      const next = setDeep(held, fields, op.value) as TextStyle;
      return withBody(sheet, {
        ...body,
        styles: { ...body.styles, styles: { ...body.styles.styles, [key]: next } }
      });
    }
    refuse(op, "a style path is styles/defaultKey or styles/styles/<key>/<field>");
  }

  if (root === "rows" || root === "columns") {
    const [id, field, ...more] = rest;
    const size = root === "rows" ? "height" : "width";
    if (!id || field !== size || more.length > 0) refuse(op, `${root}/<id>/${size}`);
    if (op.value !== null && (typeof op.value !== "number" || op.value <= 0)) {
      refuse(op, "a size is a positive number");
    }
    const list = body[root];
    if (!list.some((entry) => entry.id === id)) refuse(op, `no ${root} entry ${id}`);
    const next = list.map((entry) => (entry.id === id ? withField(entry, size, op.value) : entry));
    return withBody(sheet, { ...body, [root]: next } as SpreadsheetBody);
  }

  return refuse(op, "not a field of the sheet");
};

const listStyles = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "styles") refuse(op, "styles are the one list on the sheet");
  const styles = { ...sheet.body.styles.styles };
  if (op.op === "insert") {
    const values = op.values as TextStyle[];
    if (values.length !== op.ids.length) refuse(op, "ids and values disagree");
    for (const [index, key] of op.ids.entries()) {
      if (styles[key] !== undefined) refuse(op, `a style ${key} is already there`);
      styles[key] = values[index];
    }
  } else {
    for (const key of op.ids) {
      if (styles[key] === undefined) refuse(op, `no style ${key} to remove`);
      if (key === sheet.body.styles.defaultKey) refuse(op, "the default style stays");
      if (sheet.body.formatRules.some((rule) => rule.style === key)) {
        refuse(op, `a rule still names ${key}`);
      }
      delete styles[key];
    }
  }
  return withBody(sheet, { ...sheet.body, styles: { ...sheet.body.styles, styles } });
};

const applyOne = (sheet: LiveSheet, op: SpreadsheetOp): LiveSheet => {
  switch (op.op) {
    case "set":
      switch (op.target) {
        case "cell":
          return setCell(sheet, op);
        case "mark":
          return setMark(sheet, op);
        case "formatRule":
          return setRule(sheet, op);
        case "sheet":
          return setSheet(sheet, op);
      }
      return refuse(op, "not a target a set can name");
    case "insert":
    case "remove":
      switch (op.target) {
        case "gridRow":
          return listRows(sheet, op);
        case "gridColumn":
          return listColumns(sheet, op);
        case "formatRule":
          return listRules(sheet, op);
        case "mark":
          return listMarks(sheet, op);
        case "sheet":
          return listStyles(sheet, op);
      }
      return refuse(op, "not a target a list op can name");
    case "move":
      return move(sheet, op);
  }
};

export const applyOps = (sheet: LiveSheet, ops: readonly SpreadsheetOp[]): LiveSheet =>
  ops.reduce(applyOne, sheet);

export const invert = (op: SpreadsheetOp): SpreadsheetOp => {
  switch (op.op) {
    case "set":
      return { ...op, value: op.was, was: op.value };
    case "insert":
      return { ...op, op: "remove" };
    case "remove":
      return { ...op, op: "insert" };
    case "move":
      return { ...op, after: op.wasAfter, wasAfter: op.after };
  }
};

export const invertAll = (ops: readonly SpreadsheetOp[]): SpreadsheetOp[] =>
  [...ops].reverse().map(invert);
