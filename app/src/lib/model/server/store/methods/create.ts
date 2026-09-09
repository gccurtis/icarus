import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$representation/store/tables";

import type { MutationState } from "$model/server/store/methods/shared/state";
import { replaceRows, rowsOf } from "$model/server/store/methods/shared/state";
import { admittedRow, mintId } from "$model/server/store/methods/shared/rows";

export const create = <T extends TableName>(
  state: MutationState,
  table: T,
  fields: unknown
): Id<T> => {
  const current = rowsOf(state, table);
  const id = mintId(table, new Set(current.map((row) => row._id)));
  replaceRows(state, table, [...current, admittedRow(table, fields, id, state.now())]);
  return id;
};
