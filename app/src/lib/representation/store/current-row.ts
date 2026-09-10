import { asStorable, type AnyRow } from "$representation/store/path";
import { isStoredRowId } from "$representation/data/behavior/core/stored";
import { CURRENT_ROW_POLICIES } from "$representation/store/current-schema";
import { hasCurrentRowValues } from "$representation/store/current-values";
import type { TableName, TableRow } from "$representation/store/tables";

type Fields = Record<string, unknown>;

const fieldsOf = (value: unknown, subject: string): Fields => {
  const stored = asStorable(value);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    throw new Error(`${subject} is an object`);
  }
  return stored as Fields;
};

/** Admits exactly one complete row in the one current top-level table schema. */
export const admitCurrentRow = <T extends TableName>(table: T, value: unknown): TableRow<T> => {
  const row = fieldsOf(value, `a '${table}' row`);
  if (!isStoredRowId(row._id, table)) throw new Error(`a '${table}' row has one canonical id`);
  if (typeof row._creationTime !== "number" || !Number.isFinite(row._creationTime) || row._creationTime < 0) {
    throw new Error(`a '${table}' row has a finite non-negative creation time`);
  }

  const policy = CURRENT_ROW_POLICIES[table] as Record<string, "required" | "optional">;
  const admitted = new Set(["_id", "_creationTime", ...Object.keys(policy)]);
  const unknown = Object.keys(row).filter((field) => !admitted.has(field));
  if (unknown.length > 0) {
    throw new Error(`a '${table}' row has unknown ${unknown.length === 1 ? "field" : "fields"}: ${unknown.join(", ")}`);
  }
  const missing = Object.entries(policy)
    .filter(([field, presence]) => presence === "required" && !Object.hasOwn(row, field))
    .map(([field]) => field);
  if (missing.length > 0) {
    throw new Error(`a '${table}' row is missing required ${missing.length === 1 ? "field" : "fields"}: ${missing.join(", ")}`);
  }
  if (!hasCurrentRowValues(table, row)) {
    throw new Error(`a '${table}' row has non-current field values`);
  }
  return row as unknown as TableRow<T>;
};

/** Admits an exact table image and refuses duplicate identities. */
export const admitCurrentRows = <T extends TableName>(table: T, value: unknown): readonly TableRow<T>[] => {
  if (!Array.isArray(value)) throw new Error(`the '${table}' table is an array`);
  const rows = value.map((row) => admitCurrentRow(table, row));
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row._id)) throw new Error(`the '${table}' table repeats row id '${row._id}'`);
    ids.add(row._id);
  }
  return rows;
};

/** Internal bridge for Store state, after the table-specific proof has succeeded. */
export const admitAnyRows = (table: TableName, value: unknown): readonly AnyRow[] =>
  admitCurrentRows(table, value) as readonly AnyRow[];
