import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { projectResourceOf } from "$capabilities/project/api/shared/resources";
import { validateUpdateProjectResourceSummary } from "$capabilities/project/api/update-project-resource-summary/validate-update-project-resource-summary";
import type { UpdateProjectResourceSummaryResult } from "$capabilities/project/types/project";

/** Update the reader-authored executive summary without accepting identity from the client. */
export const updateProjectResourceSummary = async (
  input: unknown
): Promise<UpdateProjectResourceSummaryResult> => {
  const scope = await requireScope();
  const asked = validateUpdateProjectResourceSummary(input);
  const store = serverModel().store;
  const resource = projectResourceOf(store, scope.projectId, asked.resourceId);
  if (resource === undefined) {
    throw new Error(`project/update-resource-summary: no resource ${asked.resourceId}`);
  }

  const path = `${resource.spec.table}.${asked.resourceId}`;
  if (asked.summary.length === 0) store.remove(`${path}.summary`);
  else store.update(`${path}.summary`, asked.summary);

  const updatedAt = Date.now();
  store.update(`${path}.updatedAt`, updatedAt);
  if (resource.spec.hasUpdatedBy) {
    store.update(`${path}.updatedBy`, {
      kind: "user",
      userId: asId<"users">(scope.userId)
    });
  }

  return { resourceId: asked.resourceId, summary: asked.summary, updatedAt };
};
