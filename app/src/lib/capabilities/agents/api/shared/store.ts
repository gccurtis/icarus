import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";

export type RowFields<T extends TableName> = Omit<TableRow<T>, "_id" | "_creationTime">;

export const rowsIn = <T extends TableName>(store: StoreModel, table: T): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.table !== table || found.kind !== "table" || !Array.isArray(found.rows)) return [];
  return found.rows.filter(
    (row) => row !== null && typeof row === "object" && !Array.isArray(row)
  ) as readonly TableRow<T>[];
};

export const rowIn = <T extends TableName>(
  store: StoreModel,
  table: T,
  id: string
): TableRow<T> | undefined => rowsIn(store, table).find((row) => row._id === id);

export const canonicalRowId = (value: unknown, table: TableName): string | undefined =>
  typeof value === "string" &&
  value.length <= 500 &&
  value.startsWith(`${table}:`) &&
  value.slice(table.length + 1).length > 0 &&
  !/[.:\s]/.test(value.slice(table.length + 1))
    ? value
    : undefined;

export const uniqueId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
