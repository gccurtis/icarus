import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import type { ReadViewStateResult } from "$capabilities/view/types/read-view-state";

export const readViewState = async (): Promise<ReadViewStateResult> => {
  const scope = await requireScope();

  const found = serverModel().store.read("viewSnapshots");
  if (found?.table !== "viewSnapshots" || found.kind !== "table") return null;

  const row = found.rows.find(
    (candidate) => candidate.projectId === scope.projectId && candidate.userId === scope.userId
  );
  if (row === undefined) return null;

  return { revision: row.revision, tabs: row.tabs, activeId: row.activeId, views: row.views };
};
