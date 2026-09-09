import type { StoreUnitOfWork, TableName, TableRow } from "$model/server/store/index.server";

export type RowFields<T extends TableName> = Omit<TableRow<T>, "_id" | "_creationTime">;

export const rowsIn = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly unknown[] => {
  const found = store.read(table);
  if (found?.table !== table || found.kind !== "table" || !Array.isArray(found.rows)) return [];
  return found.rows;
};

export const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const recordsIn = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly Record<string, unknown>[] => rowsIn(store, table).flatMap((value) => {
  const record = recordOf(value);
  return record === undefined ? [] : [record];
});

/** A row id is one bounded Store path segment for the table it names. */
export const canonicalRowId = (value: unknown, table: TableName): string | undefined =>
  typeof value === "string" &&
  value.length <= 500 &&
  value.startsWith(`${table}:`) &&
  value.slice(table.length + 1).length > 0 &&
  !/[.:\s]/.test(value.slice(table.length + 1))
    ? value
    : undefined;

export const rowIn = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T,
  id: string
): TableRow<T> | undefined =>
  recordsIn(store, table).find((row) => row._id === id) as TableRow<T> | undefined;
