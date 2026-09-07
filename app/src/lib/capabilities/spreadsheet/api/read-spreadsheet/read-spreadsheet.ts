import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { cellOf, cellRowsOf } from "$capabilities/spreadsheet/api/shared/cells";
import { leaderOf } from "$capabilities/spreadsheet/api/shared/leader";
import { validateReadSpreadsheet } from "$capabilities/spreadsheet/api/read-spreadsheet/validate-read-spreadsheet";
import type { ReadSpreadsheetResult } from "$capabilities/spreadsheet/types/read-spreadsheet";

export const readSpreadsheet = async (input: unknown): Promise<ReadSpreadsheetResult> => {
  const scope = await requireScope();
  const asked = validateReadSpreadsheet(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const resourceId = asked.resourceId as Id<"spreadsheets">;

  const leader = leaderOf(store, projectId, resourceId);
  if (leader === undefined) return null;

  return {
    revision: leader.revision,
    body: leader.body,
    cells: cellRowsOf(store, projectId, resourceId).map(cellOf)
  };
};
