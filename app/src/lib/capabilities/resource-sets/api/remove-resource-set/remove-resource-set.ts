import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel } from "$model/server/store/index.server";

import {
  admitStoredSet,
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

const promptWords = (value: unknown): string => {
  const words = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return words.length > 60 ? `${words.slice(0, 57)}…` : words;
};

/**
 * The resource whose Prompt Block still reads this set, by title.
 *
 * A block carries its own scope before it is linked to anything, so the derived
 * outputs alone do not account for every reader. Only leader revisions are
 * looked at: an earlier revision is history, and cannot be refreshed.
 */
const readingResources = (
  store: StoreModel,
  projectId: string,
  setId: string
): string | undefined => {
  for (const [snapshots, resources] of [
    ["documentSnapshots", "documents"],
    ["slideDeckSnapshots", "slideDecks"]
  ] as const) {
    const found = recordsIn(store, snapshots).find(
      (row) => row.projectId === projectId && row.role === "leader" && namesSet(row.body, setId)
    );
    if (found === undefined) continue;
    const resource = recordsIn(store, resources).find((row) => row._id === found.resourceId);
    return typeof resource?.title === "string" ? resource.title : "an open resource";
  }
  return undefined;
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
  let stored: ReturnType<typeof admitStoredSet>;
  try {
    stored = admitStoredSet(found.set);
  } catch (error) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "corrupt",
      revision: reportableRevision(found.set.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }
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
    (row) => row.projectId === scope.projectId && namesSet(row.holes, stored._id)
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

  const usedByOutput = recordsIn(store, "derivedOutputs").find(
    (row) => row.projectId === scope.projectId && namesSet(row.scope, stored._id)
  );
  if (usedByOutput !== undefined) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "in-use",
      revision: reportableRevision(stored.revision),
      detail: `a prompt still reads it: "${promptWords(usedByOutput.prompt)}"`
    };
  }

  const usedByBlock = readingResources(store, scope.projectId, stored._id);
  if (usedByBlock !== undefined) {
    return {
      accepted: false,
      setId: asked.setId,
      reason: "in-use",
      revision: reportableRevision(stored.revision),
      detail: `a Prompt Block in "${usedByBlock}" still reads it`
    };
  }

  store.remove(`resourceSets.${stored._id}`);
  return { accepted: true, setId: stored._id, revision: stored.revision };
};
