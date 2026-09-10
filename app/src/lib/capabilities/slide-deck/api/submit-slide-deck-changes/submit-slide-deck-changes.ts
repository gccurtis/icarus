import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { leaderOf } from "$capabilities/slide-deck/api/shared/leader";
import { applyOps } from "$capabilities/slide-deck/api/submit-slide-deck-changes/apply-ops";
import { validateSubmitSlideDeckChanges } from "$capabilities/slide-deck/api/submit-slide-deck-changes/validate-submit-slide-deck-changes";
import type { SubmitSlideDeckChangesResult } from "$capabilities/slide-deck/types/submit-slide-deck-changes";
import { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay/index";

export const submitSlideDeckChanges = async (
  input: unknown
): Promise<SubmitSlideDeckChangesResult> => {
  const scope = await requireScope();
  const { changeSet } = validateSubmitSlideDeckChanges(input);

  const model = serverModel();
  const store = model.store;
  const projectId = asId<"projects">(scope.projectId);
  const resourceId = asId<"slideDecks">(changeSet.resourceId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };

  const leader = leaderOf(store, projectId, resourceId);
  const revision = leader?.revision ?? 0;

  if (leader === undefined) {
    return {
      accepted: false,
      reason: "unresolved",
      revision,
      detail: `no body is stored for ${changeSet.resourceId}`
    };
  }

  if (changeSet.baseRevision !== revision) {
    return {
      accepted: false,
      reason: "stale",
      revision,
      detail: `authored against revision ${changeSet.baseRevision}, the leader is at ${revision}`
    };
  }

  let body;
  try {
    body = applyOps(leader.body, changeSet.ops);
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

  store.transaction((unit) => {
    unit.create("slideDeckChangeSets", {
      projectId,
      resourceId,
      revision: next,
      baseRevision: changeSet.baseRevision,
      tier: "recent",
      ops: changeSet.ops,
      touched: changeSet.touched,
      actor,
      at
    });

    unit.update(`slideDeckSnapshots.${leader._id}`, {
      projectId,
      resourceId,
      revision: next,
      role: "leader",
      part: 0,
      body,
      at
    });

    unit.update(`slideDecks.${resourceId}.updatedAt`, at);
    unit.update(`slideDecks.${resourceId}.updatedBy`, actor);
    enqueueSemanticOutboxFor(
      model,
      unit,
      projectId,
      { kind: "slides", id: resourceId },
      next
    );
  });

  return { accepted: true, revision: next };
};
