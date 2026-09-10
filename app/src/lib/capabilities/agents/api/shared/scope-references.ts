import type { StoreModel } from "$model/server/store/index.server";
import { resourceSetReferenceIssue } from "$representation/data/behavior/core/resource-set";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import { rowsIn } from "$capabilities/agents/api/shared/store";

/** Validates a persisted agent scope against this project's reusable named sets. */
export const scopeReferenceRefusal = (
  store: StoreModel,
  projectId: string,
  scope: ResourceSet | undefined
): string | undefined => {
  if (scope === undefined) return undefined;
  const reusable = admittedReusableResourceSets(rowsIn(store, "resourceSets"), projectId);
  const named = new Map<string, ResourceSet>(
    [...reusable].map(([id, row]) => [id, row.set])
  );
  const issue = resourceSetReferenceIssue(scope, named);
  if (issue === undefined) return undefined;
  return issue.kind === "cycle"
    ? `scope set references form a cycle through ${issue.setId}`
    : `scope set ${issue.setId} is not one reusable set in this project`;
};
