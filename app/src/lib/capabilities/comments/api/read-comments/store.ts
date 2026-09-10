import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName,
  type TableRow
} from "$model/server/store/index.server";

/** Read one complete current table image; impossible Store results fail closed. */
export const rowsIn = <T extends TableName>(
  store: StoreUnitOfWork,
  table: T
): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};
