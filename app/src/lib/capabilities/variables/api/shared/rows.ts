import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableRow
} from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { VariableRecord } from "$capabilities/variables/types/variables";

export type VariableRow = TableRow<"variables">;

/** The smallest port a lookup needs, so the Store and a unit of work both fit. */
export type StoreReads = Pick<StoreUnitOfWork, "read">;

export const variableRowsOf = (store: StoreReads, projectId: Id<"projects">): readonly VariableRow[] => {
  return readCurrentRows(store, "variables").filter((row) => row.projectId === projectId);
};

export const sameName = (one: string, other: string): boolean =>
  one.toLowerCase() === other.toLowerCase();

export const recordOf = (row: VariableRow): VariableRecord => ({
  id: row._id,
  name: row.name,
  value: row.value,
  type: row.type,
  ...(row.description === undefined ? {} : { description: row.description }),
  updatedAt: row.updatedAt
});
