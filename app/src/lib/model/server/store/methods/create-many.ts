import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$representation/store/tables";

import { admittedRow, mintId } from "$model/server/store/methods/shared/rows";
import { replaceRows, requireAvailable, rowsOf } from "$model/server/store/methods/shared/state";
import type { MutationState } from "$model/server/store/methods/shared/state";

export const createMany = <T extends TableName>(
  state: MutationState,
  table: T,
  fields: readonly unknown[]
): readonly Id<T>[] => {
  requireAvailable(state);
  if (fields.length === 0) return [];
  const at = state.now();
  const current = rowsOf(state, table);
  const taken = new Set(current.map((row) => row._id));
  const ids = fields.map(() => {
    const id = mintId(table, taken);
    taken.add(id);
    return id;
  });
  const created = fields.map((entry, index) => admittedRow(table, entry, ids[index], at));
  replaceRows(state, table, [...current, ...created]);
  return ids;
};
