import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  recordsIn,
  reportableRevision,
  visibleSet
} from "$capabilities/resource-sets/api/shared/projection";
import { validateRemoveResourceSet } from "$capabilities/resource-sets/api/remove-resource-set/validate-remove-resource-set";
import type { RemoveResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";

const namesSet = (value: unknown, setId: string): boolean => {
  if (Array.isArray(value)) return value.some((entry) => namesSet(entry, setId));
  if (value === null || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  if (fields.select === "set" && fields.setId === setId) return true;
  return Object.values(fields).some((nested) => namesSet(nested, setId));
};

export const removeResourceSet = async (input: unknown): Promise<RemoveResourceSetResult> => {
  const scope = await requireScope();
  const asked = validateRemoveResourceSet(input);

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
      detail: `deletion asked for revision ${asked.baseRevision}, the set is at ${stored.revision}`
    };
  }

  const usedBySet = recordsIn(store, "resourceSets").find(
    (row) => row._id !== stored._id && namesSet(row.set, stored._id)
  );
  if (usedBySet !== undefined) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "in-use",
      revision: reportableRevision(stored.revision),
      detail: `the set "${String(usedBySet.name)}" still names it`
    };
  }

  const usedByTemplate = recordsIn(store, "templates").find(
    (row) => row.projectId === scope.projectId && namesSet(row.variables, stored._id)
  );
  if (usedByTemplate !== undefined) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "in-use",
      revision: reportableRevision(stored.revision),
      detail: `the template "${String(usedByTemplate.name)}" still names it`
    };
  }

  store.remove(`resourceSets.${stored._id}`);
  return { accepted: true, setId: stored._id, revision: stored.revision };
};
