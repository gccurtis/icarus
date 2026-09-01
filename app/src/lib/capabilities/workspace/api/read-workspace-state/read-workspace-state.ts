import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import type { ReadWorkspaceStateResult } from "$capabilities/workspace/types/read-workspace-state";

export const readWorkspaceState = async (): Promise<ReadWorkspaceStateResult> => {
  const scope = await requireScope();

  const found = serverModel().store.read("workspaceSnapshots");
  if (found?.table !== "workspaceSnapshots" || found.kind !== "table") return null;

  const row = found.rows.find(
    (candidate) => candidate.projectId === scope.projectId && candidate.userId === scope.userId
  );
  if (row === undefined) return null;

  return { revision: row.revision, tabs: row.tabs, activeId: row.activeId, views: row.views };
};
