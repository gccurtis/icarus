import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentOp } from "$representation/data/types/documents/op";

import { leaderOf } from "$capabilities/document/api/shared/leader";
import { withoutSharedReferences } from "$capabilities/document/api/shared/without-shared-references";
import { applyOps } from "$capabilities/document/api/submit-document-changes/apply-ops";
import { validateSubmitDocumentChanges } from "$capabilities/document/api/submit-document-changes/validate-submit-document-changes";
import type { SubmitDocumentChangesResult } from "$capabilities/document/types/submit-document-changes";

type Landed = { readonly revision: number; readonly ops: readonly DocumentOp[]; readonly touched: readonly string[] };

const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

const landedBetween = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"documents">,
  base: number,
  head: number
): readonly Landed[] | undefined => {
  const found = store.read("documentChangeSets");
  if (found?.table !== "documentChangeSets" || found.kind !== "table") return undefined;

  const landed = found.rows
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.resourceId === resourceId &&
        row.revision > base &&
        row.revision <= head
    )
    .sort((a, b) => a.revision - b.revision);

  return landed.length === head - base ? landed : undefined;
};

const catchUpFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"documents">,
  base: number,
  head: number,
  touched: readonly string[]
): readonly DocumentOp[] | undefined => {
  if (base === head) return [];
  if (base > head) return undefined;

  const landed = landedBetween(store, projectId, resourceId, base, head);
  if (landed === undefined) return undefined;

  const clashes = landed.some((held) =>
    held.touched.some((theirs) => touched.some((mine) => related(mine, theirs)))
  );
  return clashes ? undefined : landed.flatMap((held) => held.ops);
};

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

  const catchUp = catchUpFor(
    store,
    projectId,
    resourceId,
    changeSet.baseRevision,
    revision,
    changeSet.touched
  );
  if (catchUp === undefined) {
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

  return catchUp.length === 0
    ? { accepted: true, revision: next }
    : { accepted: true, revision: next, catchUp };
};
