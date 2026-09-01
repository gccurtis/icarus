import type { Id } from "$representation/data/types/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateSubmitViewChanges } from "$capabilities/view/api/submit-view-changes/validate-submit-view-changes";
import type { SubmitViewChangesResult } from "$capabilities/view/types/submit-view-changes";

export const submitViewChanges = async (input: unknown): Promise<SubmitViewChangesResult> => {
  const scope = await requireScope();
  const change = validateSubmitViewChanges(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const userId = scope.userId as Id<"users">;

  const found = store.read("viewSnapshots");
  const current =
    found?.table === "viewSnapshots" && found.kind === "table"
      ? found.rows.find((row) => row.projectId === projectId && row.userId === userId)
      : undefined;

  const revision = (current?.revision ?? 0) + 1;
  const at = Date.now();

  store.create("viewRevisions", {
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

  if (current) store.update(`viewSnapshots.${current._id}`, snapshot);
  else store.create("viewSnapshots", snapshot);

  return { revision };
};
