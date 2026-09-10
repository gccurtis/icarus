import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { QuerySemanticMaterialsResult } from "$capabilities/semantic-overlay/types/query-semantic-materials";

import { querySemanticMaterialsForModel } from "$capabilities/semantic-overlay/api/shared/query-materials-for-model";
import { validateQuerySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/validate-query-semantic-materials";

/** Authenticated request adapter for interpreted material search. */
export const querySemanticMaterials = async (
  input: unknown,
  signal?: AbortSignal
): Promise<QuerySemanticMaterialsResult> => {
  const scope = await requireScope();
  const asked = validateQuerySemanticMaterials(input);
  return querySemanticMaterialsForModel(
    serverModel(),
    scope.projectId as Id<"projects">,
    asked,
    signal
  );
};
