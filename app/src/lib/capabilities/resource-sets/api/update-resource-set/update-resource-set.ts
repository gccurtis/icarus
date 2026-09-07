import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  admitStoredSet,
  reportableRevision,
  visibleSet
} from "$capabilities/resource-sets/api/shared/projection";
import { validateUpdateResourceSet } from "$capabilities/resource-sets/api/update-resource-set/validate-update-resource-set";
import type { UpdateResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";

export const updateResourceSet = async (input: unknown): Promise<UpdateResourceSetResult> => {
  const scope = await requireScope();
  const asked = validateUpdateResourceSet(input);

  const store = serverModel().store;
  const found = visibleSet(store, scope, asked.setId);
  if (found.kind !== "found") {
    return {
      accepted: false,
      setId: asked.setId,
      reason: found.kind === "missing" ? "not-found" : "corrupt",
      revision: null,
      detail: found.kind === "missing" ? "no set in this project has that id" : found.detail
    };
  }
  const stored = found.set;
  if (stored.revision !== asked.baseRevision) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "stale",
      revision: reportableRevision(stored.revision),
      detail: `authored against revision ${asked.baseRevision}, the set is at ${stored.revision}`
    };
  }
  let held: ReturnType<typeof admitStoredSet>;
  try {
    held = admitStoredSet(stored);
  } catch (error) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "corrupt",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }
  if (asked.patch.set?.include.some((term) => term.select === "set" && term.setId === held._id)) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "corrupt",
      revision: held.revision,
      detail: "a set cannot include itself"
    };
  }

  const description =
    asked.patch.description === null ? undefined : (asked.patch.description ?? held.description);
  store.update(`resourceSets.${held._id}`, {
    projectId: held.projectId,
    name: asked.patch.name ?? held.name,
    ...(description === undefined || description === "" ? {} : { description }),
    set: asked.patch.set ?? held.set,
    createdBy: held.createdBy,
    revision: held.revision + 1,
    updatedAt: Date.now()
  });

  return { accepted: true, setId: held._id, revision: held.revision + 1 };
};
