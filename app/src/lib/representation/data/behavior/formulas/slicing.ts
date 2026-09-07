import { fail } from "$representation/data/behavior/formulas/refusals";
import { EMPTY, columnNames, list, record, rowRecord, recordTable, table } from "$representation/data/behavior/formulas/values";
import type { FormulaColumn, FormulaValue } from "$representation/data/types/content/formula-value";
import type { Slice } from "$representation/data/types/formulas/expression";

/** What a value looks like when it is asked for rows. */
type Rows = {
  readonly columns: readonly FormulaColumn[] | undefined;
  readonly rows: readonly FormulaValue[];
};

const rowsOf = (of: FormulaValue): Rows => {
  if (of.kind === "list") return { columns: undefined, rows: of.values };
  if (of.kind === "table") return { columns: of.columns, rows: of.rows.map((row) => rowRecord(of.columns, row)) };
  if (of.kind === "record") return { columns: undefined, rows: Object.values(of.fields) };
  return fail("#SHAPE!");
};

const at = (index: number, length: number): number => (index < 0 ? length + index : index);

const bounded = (index: number, length: number): number => Math.min(Math.max(at(index, length), 0), length);

/**
 * A run of rows by position, the way Python takes one: zero based, end excluded,
 * negatives counting back, either end optional.
 *
 * Nothing survives is an answer rather than a refusal. Indexing an empty result
 * gives empty, so an optimistic filter does not have to be wrapped to be safe;
 * a position past the end of something that does have rows is `#INDEX!`.
 */
export const indexed = (of: FormulaValue, slice: Slice): FormulaValue => {
  const held = rowsOf(of);
  const length = held.rows.length;

  if (slice.kind === "pick") {
    if (length === 0) return EMPTY;
    const position = at(slice.at, length);
    if (position < 0 || position >= length) fail("#INDEX!");
    return held.rows[position];
  }

  const from = slice.from === undefined ? 0 : bounded(slice.from, length);
  const to = slice.to === undefined ? length : bounded(slice.to, length);
  const taken = held.rows.slice(from, Math.max(from, to));

  if (of.kind === "table") {
    const columns = of.columns;
    const names = columnNames(columns);
    return table(
      columns,
      taken.map((row) => (row.kind === "record" ? names.map((name) => row.fields[name] ?? EMPTY) : [row]))
    );
  }
  if (of.kind === "record") {
    const names = Object.keys(of.fields);
    const fields: Record<string, FormulaValue> = {};
    names.slice(from, Math.max(from, to)).forEach((name) => {
      fields[name] = of.fields[name];
    });
    return record(fields);
  }
  return list(taken);
};

/**
 * One field by name. A table answers with that column as a list; a record
 * answers with the value. A shape with no fields at all is `#SHAPE!`, and a
 * shape that has fields but not this one is `#FIELD?`.
 */
export const fielded = (of: FormulaValue, field: string): FormulaValue => {
  if (of.kind === "record") {
    if (!(field in of.fields)) fail("#FIELD?", field);
    return of.fields[field];
  }
  if (of.kind === "table") {
    const names = columnNames(of.columns);
    const column = names.indexOf(field);
    if (column === -1) fail("#FIELD?", field);
    return list(of.rows.map((row) => row[column] ?? EMPTY));
  }
  if (of.kind === "empty") return EMPTY;
  return fail("#SHAPE!");
};

/**
 * Rows that mean something, and the fields worth keeping.
 *
 * Selection runs before projection, so a predicate may name a field the
 * projection drops. `holds` is handed each row as a record and answers whether
 * to keep it; the language, not this file, decides what a predicate is.
 */
export const queried = (
  of: FormulaValue,
  keep: readonly string[],
  holds: (row: FormulaValue) => boolean
): FormulaValue => {
  const source =
    of.kind === "table"
      ? { columns: of.columns, rows: of.rows }
      : of.kind === "record"
        ? recordTable(of.fields)
        : fail("#SHAPE!");

  const names = columnNames(source.columns);
  const kept = source.rows.filter((row) => holds(rowRecord(source.columns, row)));

  if (keep.length === 0) return table(source.columns, kept);

  const wanted = keep.map((name) => {
    const column = names.indexOf(name);
    if (column === -1) fail("#FIELD?", name);
    return column;
  });
  return table(
    wanted.map((column) => source.columns[column]),
    kept.map((row) => wanted.map((column) => row[column] ?? EMPTY))
  );
};
