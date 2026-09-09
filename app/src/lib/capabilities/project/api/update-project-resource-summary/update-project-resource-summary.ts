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
  const updatedAt = Date.now();
  return store.transaction((unit) => {
    const resource = projectResourceOf(unit, scope.projectId, asked.resourceId);
    if (resource === undefined) {
      throw new Error(`project/update-resource-summary: no resource ${asked.resourceId}`);
    }

    const path = `${resource.spec.table}.${asked.resourceId}`;
    if (asked.summary.length === 0) unit.remove(`${path}.summary`);
    else unit.update(`${path}.summary`, asked.summary);
    unit.update(`${path}.updatedAt`, updatedAt);
    if (resource.spec.hasUpdatedBy) {
      unit.update(`${path}.updatedBy`, {
        kind: "user",
        userId: asId<"users">(scope.userId)
      });
    }

    return { resourceId: asked.resourceId, summary: asked.summary, updatedAt };
  });
};
