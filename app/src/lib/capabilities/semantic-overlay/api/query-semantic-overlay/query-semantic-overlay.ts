import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { QuerySemanticOverlayResult } from "$capabilities/semantic-overlay/types/query-semantic-overlay";

import { querySemanticOverlayForModel } from "$capabilities/semantic-overlay/api/shared/query-text-for-model";
import { validateQuerySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/validate-query-semantic-overlay";

/** Authenticated request adapter for exact text search. */
export const querySemanticOverlay = async (
  input: unknown,
  signal?: AbortSignal
): Promise<QuerySemanticOverlayResult> => {
  const scope = await requireScope();
  const asked = validateQuerySemanticOverlay(input);
  return querySemanticOverlayForModel(
    serverModel(),
    scope.projectId as Id<"projects">,
    asked,
    signal
  );
};
