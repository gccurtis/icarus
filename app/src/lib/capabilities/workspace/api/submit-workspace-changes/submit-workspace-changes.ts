import { startingWorkspace } from "$representation/data/behavior/workspace/starting";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { Id } from "$representation/data/types/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { leaderOf, since } from "$capabilities/workspace/api/shared/leader";
import { overlap, touched } from "$capabilities/workspace/api/shared/touched";
import { applyOps } from "$capabilities/workspace/api/submit-workspace-changes/apply-ops";
import { validateSubmitWorkspaceChanges } from "$capabilities/workspace/api/submit-workspace-changes/validate-submit-workspace-changes";
import type { SubmitWorkspaceChangesResult } from "$capabilities/workspace/types/submit-workspace-changes";

export const submitWorkspaceChanges = async (
  input: unknown
): Promise<SubmitWorkspaceChangesResult> => {
  const scope = await requireScope();
  const changeSet = validateSubmitWorkspaceChanges(input);

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const userId = scope.userId as Id<"users">;

  const leader = leaderOf(store, projectId, userId);
  const revision = leader?.revision ?? 0;
  const merged = changeSet.baseRevision !== revision;

  if (merged) {
    const ahead = since(store, projectId, userId, changeSet.baseRevision);
    const collides = overlap(touched(changeSet.ops), touched(ahead.flatMap((row) => row.ops)));

    if (collides.length > 0) {
      return {
        accepted: false,
        reason: "conflict",
        revision,
        detail: `${collides.join(", ")} moved between revision ${changeSet.baseRevision} and ${revision}`
      };
    }
  }

  const held = leader ?? startingWorkspace();

  let body;
  try {
    body = applyOps(held, changeSet.ops);
  } catch (error) {
    return {
      accepted: false,
      reason: "unresolved",
      revision,
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const next = revision + 1;
  const at = Date.now();

  store.create("workspaceRevisions", {
    projectId,
    userId,
    revision: next,
    baseRevision: changeSet.baseRevision,
    ops: changeSet.ops as WorkspaceOp[],
    at
  });

  const snapshot = {
    projectId,
    userId,
    revision: next,
    tabs: body.tabs,
    activeId: body.activeId,
    views: body.views,
    at
  };

  if (leader === undefined) store.create("workspaceSnapshots", snapshot);
  else store.update(`workspaceSnapshots.${leader._id}`, snapshot);

  return { accepted: true, revision: next, merged };
};
