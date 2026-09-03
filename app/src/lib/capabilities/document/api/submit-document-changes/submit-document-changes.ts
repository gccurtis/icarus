import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { leaderOf } from "$capabilities/document/api/shared/leader";
import { withoutSharedReferences } from "$capabilities/document/api/shared/without-shared-references";
import { applyOps } from "$capabilities/document/api/submit-document-changes/apply-ops";
import { validateSubmitDocumentChanges } from "$capabilities/document/api/submit-document-changes/validate-submit-document-changes";
import type { SubmitDocumentChangesResult } from "$capabilities/document/types/submit-document-changes";

export const submitDocumentChanges = async (
  input: unknown
): Promise<SubmitDocumentChangesResult> => {
  const scope = await requireScope();
  const submitted = validateSubmitDocumentChanges(input);

  const changeSet = withoutSharedReferences(submitted);
  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const resourceId = changeSet.resourceId as Id<"documents">;
  const actor = { kind: "user" as const, userId: scope.userId as Id<"users"> };

  const leader = leaderOf(store, projectId, resourceId);
  const revision = leader?.revision ?? 0;

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
    body = applyOps(leader?.body ?? { rows: [] }, changeSet.ops);
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

  store.create("documentChangeSets", {
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

  const snapshot = {
    projectId,
    resourceId,
    revision: next,
    role: "leader",
    part: 0,
    body,
    at
  };

  if (leader === undefined) store.create("documentSnapshots", snapshot);
  else store.update(`documentSnapshots.${leader._id}`, snapshot);

  store.update(`documents.${resourceId}.updatedAt`, at);
  store.update(`documents.${resourceId}.updatedBy`, actor);

  return { accepted: true, revision: next };
};
