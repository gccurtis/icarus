import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { admittedPrivateResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import { sameResourceRef } from "$representation/data/behavior/core/resource";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { BoundTo } from "$representation/data/types/core/resource-set";

import { recordsIn } from "$capabilities/templates/api/shared/store";

export type ScopeOwner = BoundTo;

export const sameScopeOwner = (held: BoundTo, owner: ScopeOwner): boolean => {
  if (owner.kind === "hole") {
    return (
      held.kind === "hole" &&
      held.templateId === owner.templateId &&
      held.hole === owner.hole
    );
  }
  return (
    held.kind === "resource" &&
    sameResourceRef(held.ref, owner.ref) &&
    held.hole === owner.hole
  );
};

/** Every private scope row bound to one resource, whichever hole it answered. */
export const rowsOfResource = (
  store: StoreUnitOfWork,
  projectId: string,
  ref: ResourceRef
): readonly string[] =>
  [...admittedPrivateResourceSets(recordsIn(store, "resourceSets"), projectId).values()]
    .filter(
      (row) => row.boundTo.kind === "resource" && sameResourceRef(row.boundTo.ref, ref)
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
