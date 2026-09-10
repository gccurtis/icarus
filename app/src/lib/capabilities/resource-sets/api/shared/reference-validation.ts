import type { StoreModel } from "$model/server/store/index.server";
import { resourceSetReferenceIssue } from "$representation/data/behavior/core/resource-set";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import { namedSetsIn } from "$capabilities/resource-sets/api/shared/projection";

/**
 * Refuses any named-set graph that crosses a project/ownership boundary, is
 * missing or ambiguous, or closes a cycle. Generic callers may traverse only
 * admitted named reusable rows; private rows remain visible solely to the
 * capability that proves their exact owner.
 */
export const resourceSetReferenceRefusal = (
  store: StoreModel,
  projectId: string,
  candidate: ResourceSet,
  selfId?: string
): string | undefined => {
  const issue = resourceSetReferenceIssue(
    candidate,
    namedSetsIn(store, projectId),
    selfId
  );
  if (issue === undefined) return undefined;
  return issue.kind === "cycle"
    ? `set references form a cycle through ${issue.setId}`
    : `set ${issue.setId} is not one reusable set in this project`;
};
