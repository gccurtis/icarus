import { admitCurrentRows } from "$representation/store/current-row";
import type { TableName, TableRow } from "$representation/store/tables";

import type { StoreUnitOfWork } from "$model/server/store/types";

/**
 * Read and re-admit one complete current table image through the Store boundary.
 *
 * Capabilities use this entry instead of trusting a structurally compatible
 * test double or treating an impossible Store result as an empty table.
 */
export const readCurrentRows = <T extends TableName>(
  store: Pick<StoreUnitOfWork, "read">,
  table: T
): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) {
    throw new Error(`the Store did not return the '${table}' table`);
  }
  return admitCurrentRows(table, found.rows);
};
