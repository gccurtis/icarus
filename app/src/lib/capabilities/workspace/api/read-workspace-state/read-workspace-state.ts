import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { leaderOf } from "$capabilities/workspace/api/shared/leader";
import type { ReadWorkspaceStateResult } from "$capabilities/workspace/types/read-workspace-state";

export const readWorkspaceState = async (): Promise<ReadWorkspaceStateResult> => {
  const scope = await requireScope();

  const row = leaderOf(
    serverModel().store,
    scope.projectId as Id<"projects">,
    scope.userId as Id<"users">
  );
  if (row === undefined) return null;

  return { revision: row.revision, tabs: row.tabs, activeId: row.activeId, views: row.views };
};
