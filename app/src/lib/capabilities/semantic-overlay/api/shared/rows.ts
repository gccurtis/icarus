import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName,
  type TableRow
} from "$model/server/store/index.server";

/** Typed table read at the capability boundary; an impossible Store result fails closed. */
export const rowsOf = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};
