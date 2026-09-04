import type {
  StoreModel,
  TableName,
  TableRow
} from "$model/server/store/index.server";

/** Typed table read at the capability boundary; an absent table is empty. */
export const rowsOf = <T extends TableName>(
  store: StoreModel,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) return [];
  return found.rows as unknown as readonly TableRow<T>[];
};
