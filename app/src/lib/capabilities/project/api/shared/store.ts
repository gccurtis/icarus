import type { StoreUnitOfWork, TableName, TableRow } from "$model/server/store/index.server";

export type StoreReads = Pick<StoreUnitOfWork, "read">;

export const rowsIn = <T extends TableName>(
  store: StoreReads,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  return found?.kind === "table" && found.table === table && Array.isArray(found.rows)
    ? (found.rows as readonly TableRow<T>[])
    : [];
};

export const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const exact = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const keys = Object.keys(value);
  return required.every((field) => keys.includes(field)) &&
    keys.every((field) => required.includes(field) || optional.includes(field));
};

export const recordsIn = (
  store: StoreReads,
  table: TableName
): readonly Record<string, unknown>[] =>
  rowsIn(store, table).flatMap((row) => {
    const record = recordOf(row);
    return record === undefined ? [] : [record];
  });

export const boundedText = (
  value: unknown,
  maximum = 10_000
): string | undefined =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value
    : undefined;

export const finiteTime = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
