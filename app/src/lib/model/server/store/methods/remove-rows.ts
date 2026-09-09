import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$representation/store/tables";

import { requireRows } from "$model/server/store/methods/shared/rows";
import { replaceRows, requireAvailable, rowsOf } from "$model/server/store/methods/shared/state";
import type { MutationState } from "$model/server/store/methods/shared/state";

export const removeRows = <T extends TableName>(
  state: MutationState,
  table: T,
  ids: readonly Id<T>[]
): void => {
  requireAvailable(state);
  if (ids.length === 0) return;
  const current = rowsOf(state, table);
  const wanted = requireRows(current, table, ids);
  replaceRows(state, table, current.filter((row) => !wanted.has(row._id)));
};
