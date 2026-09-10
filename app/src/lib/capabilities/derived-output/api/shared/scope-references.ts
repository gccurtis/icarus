import type { StoreModel } from "$model/server/store/index.server";
import { resourceSetReferenceIssue } from "$representation/data/behavior/core/resource-set";
import { admittedReusableResourceSets } from "$representation/data/behavior/core/resource-set-rows";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import { rowsOf } from "$capabilities/derived-output/api/shared/rows";

/** Refuses caller-authored scopes unless every nested set is reusable here. */
export const assertReusableScopeReferences = (
  store: StoreModel,
  projectId: string,
  scope: ResourceSet | undefined
): void => {
  if (scope === undefined) return;
  const reusable = admittedReusableResourceSets(rowsOf(store, "resourceSets"), projectId);
  const named = new Map<string, ResourceSet>(
    [...reusable].map(([id, row]) => [id, row.set])
  );
  const issue = resourceSetReferenceIssue(scope, named);
  if (issue === undefined) return;
  if (issue.kind === "cycle") {
    throw new Error(`derived-output scope set references form a cycle through ${issue.setId}`);
  }
  throw new Error(
    `derived-output scope set ${issue.setId} is not one reusable set in this project`
  );
};
