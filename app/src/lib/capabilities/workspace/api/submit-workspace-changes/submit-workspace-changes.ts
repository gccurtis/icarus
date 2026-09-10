import { startingWorkspace } from "$representation/data/behavior/workspace/starting";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { Id } from "$representation/data/types/core/id";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { historyOf, leaderOf } from "$capabilities/workspace/api/shared/leader";
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

  const at = Date.now();
  return store.transaction((unit) => {
    const leader = leaderOf(unit, projectId, userId);
    const revision = leader?.revision ?? 0;
    const history = historyOf(unit, projectId, userId);
    const lastRevision = history.at(-1)?.revision ?? 0;
    if (lastRevision !== revision) {
      throw new Error("The workspace leader and revision history do not name one current revision");
    }
    if (changeSet.baseRevision > revision) {
      return {
        accepted: false as const,
        reason: "unresolved" as const,
        revision,
        detail: `base revision ${changeSet.baseRevision} is ahead of current revision ${revision}`
      };
    }
    const merged = changeSet.baseRevision !== revision;

    if (merged) {
      const ahead = history.filter((row) => row.revision > changeSet.baseRevision);
      const collides = overlap(touched(changeSet.ops), touched(ahead.flatMap((row) => row.ops)));
      if (collides.length > 0) {
        return {
          accepted: false as const,
          reason: "conflict" as const,
          revision,
          detail: `${collides.join(", ")} moved between revision ${changeSet.baseRevision} and ${revision}`
        };
      }
    }

    let body;
    try {
      const held = leader === undefined
        ? startingWorkspace()
        : { tabs: leader.tabs, activeId: leader.activeId, views: leader.views };
      body = applyOps(held, changeSet.ops);
    } catch (error) {
      return {
        accepted: false as const,
        reason: "unresolved" as const,
        revision,
        detail: error instanceof Error ? error.message : String(error)
      };
    }

    const next = revision + 1;
    unit.create("workspaceRevisions", {
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
    if (leader === undefined) unit.create("workspaceSnapshots", snapshot);
    else unit.update(`workspaceSnapshots.${leader._id}`, snapshot);
    return { accepted: true as const, revision: next, merged };
  });
};
