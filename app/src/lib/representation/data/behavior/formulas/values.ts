import { fail } from "$representation/data/behavior/formulas/refusals";
import type { DateValue, FormulaColumn, FormulaValue } from "$representation/data/types/content/formula-value";

export const EMPTY: FormulaValue = { kind: "empty" };

export const number = (value: number): FormulaValue => {
  if (!Number.isFinite(value)) fail("#NUM!");
  return { kind: "number", value };
};

export const text = (value: string): FormulaValue => ({ kind: "text", value });

export const logic = (value: boolean): FormulaValue => ({ kind: "logic", value });

export const list = (values: readonly FormulaValue[]): FormulaValue => ({ kind: "list", values: [...values] });

export const table = (columns: readonly FormulaColumn[], rows: readonly (readonly FormulaValue[])[]): FormulaValue => ({
  kind: "table",
  columns: [...columns],
  rows: rows.map((row) => [...row])
});

export const record = (fields: Readonly<Record<string, FormulaValue>>): FormulaValue => ({
  kind: "record",
  fields: { ...fields }
});

export const isEmpty = (value: FormulaValue): boolean => {
  if (value.kind === "empty") return true;
  if (value.kind === "list") return value.values.length === 0;
  if (value.kind === "table") return value.rows.length === 0;
  if (value.kind === "record") return Object.keys(value.fields).length === 0;
  return false;
};

/** Every scalar inside a value, in reading order. What an aggregate works over. */
export const flattened = (value: FormulaValue): readonly FormulaValue[] => {
  if (value.kind === "list") return value.values.flatMap(flattened);
  if (value.kind === "table") return value.rows.flatMap((row) => row.flatMap(flattened));
  if (value.kind === "record") return Object.values(value.fields).flatMap(flattened);
  return [value];
};

export const numberOf = (value: FormulaValue): number => {
  if (value.kind === "number") return value.value;
  if (value.kind === "empty") return 0;
  if (value.kind === "logic") return value.value ? 1 : 0;
  if (value.kind === "text") {
    const trimmed = value.value.trim();
    if (trimmed.length === 0) return 0;
    const read = Number(trimmed);
    if (Number.isNaN(read)) fail("#VALUE!");
    return read;
  }
  return fail("#VALUE!");
};

export const textOf = (value: FormulaValue): string => {
  if (value.kind === "text") return value.value;
  if (value.kind === "empty") return "";
  if (value.kind === "number") return String(value.value);
  if (value.kind === "logic") return value.value ? "TRUE" : "FALSE";
  if (value.kind === "date") return dateText(value.value);
  return fail("#VALUE!");
};

export const logicOf = (value: FormulaValue): boolean => {
  if (value.kind === "logic") return value.value;
  if (value.kind === "number") return value.value !== 0;
  if (value.kind === "empty") return false;
  if (value.kind === "text") {
    const said = value.value.trim().toUpperCase();
    if (said === "TRUE") return true;
    if (said === "FALSE" || said === "") return false;
  }
  return fail("#VALUE!");
};

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

export const dateText = (value: DateValue): string =>
  `${pad(value.year, 4)}-${pad(value.month, 2)}-${pad(value.day, 2)}`;

/** Numbers an aggregate should count. Text and blanks are skipped, not coerced. */
export const numbersIn = (values: readonly FormulaValue[]): readonly number[] =>
  values.flatMap((value) => (value.kind === "number" ? [value.value] : value.kind === "logic" ? [value.value ? 1 : 0] : []));

/**
 * Order between two values. Text compares case-insensitively, dates compare by
 * their instant, and a blank sorts as a zero or an empty string depending on
 * what it is being compared against.
 */
export const compare = (left: FormulaValue, right: FormulaValue): number => {
  if (left.kind === "date" && right.kind === "date") {
    return left.value.utc === right.value.utc ? 0 : left.value.utc < right.value.utc ? -1 : 1;
  }
  if (left.kind === "text" || right.kind === "text") {
    const one = textOf(left).toLowerCase();
    const other = textOf(right).toLowerCase();
    return one === other ? 0 : one < other ? -1 : 1;
  }
  const one = numberOf(left);
  const other = numberOf(right);
  return one === other ? 0 : one < other ? -1 : 1;
};

export const sameValue = (left: FormulaValue | undefined, right: FormulaValue | undefined): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/** The columns a table's rows answer to, named or not. */
export const columnNames = (columns: readonly FormulaColumn[]): readonly string[] =>
  columns.map((column, index) => column.name ?? `field${index + 1}`);

/** A table's row, read as the record it is. */
export const rowRecord = (columns: readonly FormulaColumn[], row: readonly FormulaValue[]): FormulaValue => {
  const names = columnNames(columns);
  const fields: Record<string, FormulaValue> = {};
  names.forEach((name, index) => {
    fields[name] = row[index] ?? EMPTY;
  });
  return record(fields);
};

/** A record, read as the one-row table it is. */
export const recordTable = (fields: Readonly<Record<string, FormulaValue>>): {
  columns: readonly FormulaColumn[];
  rows: readonly (readonly FormulaValue[])[];
} => ({
  columns: Object.keys(fields).map((name) => ({ name })),
  rows: [Object.values(fields)]
});
