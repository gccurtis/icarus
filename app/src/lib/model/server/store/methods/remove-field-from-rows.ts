import type { Id } from "$representation/data/types/core/id";
import type { AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import { requireRows } from "$model/server/store/methods/shared/rows";
import { replaceRows, requireAvailable, rowsOf } from "$model/server/store/methods/shared/state";
import type { MutationState } from "$model/server/store/methods/shared/state";

export const removeFieldFromRows = <T extends TableName>(
  state: MutationState,
  table: T,
  ids: readonly Id<T>[],
  field: string
): void => {
  requireAvailable(state);
  if (ids.length === 0) return;
  if (field.length === 0 || field === "_id" || field === "_creationTime") {
    throw new Error("a removable row field is required");
  }
  const current = rowsOf(state, table);
  const wanted = requireRows(current, table, ids);
  const rows = current.map((row) => {
    if (!wanted.has(row._id)) return row;
    const copy = { ...row } as Record<string, unknown>;
    delete copy[field];
    return copy as unknown as AnyRow;
  });
  replaceRows(state, table, rows);
};
