import type { ServerModel } from "$runtime/server/start.server";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type { ToolId } from "$representation/data/types/agents/tool";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { Id } from "$representation/data/types/core/id";
import { prepareOverlay, researchResources } from "$capabilities/research-chat";

import { rowsIn } from "$capabilities/agents/api/shared/store";

const NO_RESOURCES: ResourceSet = {
  include: [{ select: "resources", refs: [] }],
  exclude: []
};

export const effectiveTaskScope = (
  task: { readonly scope?: ResourceSet },
  persona: { readonly scope?: ResourceSet }
): ResourceSet => {
  if (task.scope !== undefined) return task.scope;
  if (persona.scope !== undefined) return persona.scope;
  return NO_RESOURCES;
};

export const refsInTaskScope = (
  model: ServerModel,
  projectId: Id<"projects">,
  scope: ResourceSet
): readonly ResourceRef[] => {
  const sets = admittedReusableResourceSets(rowsIn(model.store, "resourceSets"), projectId);
  return researchResources(model, projectId)
    .map((resource) => resource.ref)
    .filter((ref) => resourceInScope(ref, scope, (id) => sets.get(id)?.set));
};

/** Prepare only the exact resources the task may reach, never the wider project. */
export const prepareTaskScope = async (
  model: ServerModel,
  projectId: Id<"projects">,
  scope: ResourceSet,
  grants: readonly ToolId[],
  signal: AbortSignal
): Promise<number> => {
  const refs = refsInTaskScope(model, projectId, scope);
  if (!grants.includes("retrieve")) return 0;
  const preparable = refs.filter(
    (ref) =>
      ref.kind !== "externalFile::audio" &&
      ref.kind !== "externalFile::video" &&
      ref.kind !== "externalFile::unknown"
  );
  for (const ref of preparable) {
    signal.throwIfAborted();
    await prepareOverlay(model, projectId, { kind: "resource", ref }, signal);
  }
  return preparable.length;
};
