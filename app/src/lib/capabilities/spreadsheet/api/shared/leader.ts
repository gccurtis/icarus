import { readCurrentRows } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";

import type { StoreReads } from "$capabilities/spreadsheet/api/shared/ports";

export type Leader = {
  readonly _id: Id<"spreadsheetSnapshots">;
  readonly revision: number;
  readonly body: SpreadsheetBody;
};

export const leaderOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">
): Leader | undefined => {
  return readCurrentRows(store, "spreadsheetSnapshots").find(
    (row) =>
      row.projectId === projectId &&
      row.resourceId === resourceId &&
      row.role === "leader"
  );
};
