import type { Id } from "$representation/data/types/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateSubmitWorkspaceChanges } from "$capabilities/workspace/api/submit-workspace-changes/validate-submit-workspace-changes";
import type { SubmitWorkspaceChangesResult } from "$capabilities/workspace/types/submit-workspace-changes";

export const submitWorkspaceChanges = async (
  input: unknown
): Promise<SubmitWorkspaceChangesResult> => {
  const scope = await requireScope();
  const change = validateSubmitWorkspaceChanges(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const userId = scope.userId as Id<"users">;

  const found = store.read("workspaceSnapshots");
  const current =
    found?.table === "workspaceSnapshots" && found.kind === "table"
      ? found.rows.find((row) => row.projectId === projectId && row.userId === userId)
      : undefined;

  const revision = (current?.revision ?? 0) + 1;
  const at = Date.now();

  store.create("workspaceRevisions", {
    projectId,
    userId,
    revision,
    baseRevision: change.baseRevision,
    ops: change.ops,
    at
  });

  const snapshot = {
    projectId,
    userId,
    revision,
    tabs: change.tabs,
    activeId: change.activeId,
    views: change.views,
    at
  };

  if (current) store.update(`workspaceSnapshots.${current._id}`, snapshot);
  else store.create("workspaceSnapshots", snapshot);

  return { revision };
};
