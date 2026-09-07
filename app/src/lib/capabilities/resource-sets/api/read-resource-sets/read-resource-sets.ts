import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { projectSets } from "$capabilities/resource-sets/api/shared/projection";
import type { ReadResourceSetsResult } from "$capabilities/resource-sets/types/resource-sets";

export const readResourceSets = async (): Promise<ReadResourceSetsResult> => {
  const scope = await requireScope();
  return projectSets(serverModel().store, scope);
};
