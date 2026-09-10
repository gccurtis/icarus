import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { admittedPrivateResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type { BoundTo } from "$representation/data/types/core/resource-set";

import { recordsIn } from "$capabilities/templates/api/shared/store";

export type ScopeOwner = BoundTo;

export const sameScopeOwner = (held: unknown, owner: ScopeOwner): boolean => {
  if (held === null || typeof held !== "object") return false;
  const record = held as Record<string, unknown>;
  if (owner.kind === "hole") {
    return (
      record.kind === "hole" &&
      record.templateId === owner.templateId &&
      record.hole === owner.hole
    );
  }
  return (
    record.kind === "resource" &&
    record.resourceId === owner.resourceId &&
    record.hole === owner.hole
  );
};

/** Every private scope row bound to one resource, whichever hole it answered. */
export const rowsOfResource = (
  store: StoreUnitOfWork,
  projectId: string,
  resourceId: string
): readonly string[] =>
  [...admittedPrivateResourceSets(recordsIn(store, "resourceSets"), projectId).values()]
    .filter(
      (row) => row.boundTo.kind === "resource" && row.boundTo.resourceId === resourceId
    )
    .map((row) => row._id);

/** Private scope rows held by one owner, newest last. */
export const rowsBoundTo = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: ScopeOwner
): readonly string[] =>
  [...admittedPrivateResourceSets(recordsIn(store, "resourceSets"), projectId).values()]
    .filter((row) => sameScopeOwner(row.boundTo, owner))
    .map((row) => row._id);

export const removeRowsBoundTo = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: ScopeOwner
): number => {
  const held = rowsBoundTo(store, projectId, owner);
  for (const setId of held) store.remove(`resourceSets.${setId}`);
  return held.length;
};
