import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { readSemanticResourceForModel } from "$capabilities/semantic-overlay/api/shared/resource";
import { validateReadSemanticResource } from "$capabilities/semantic-overlay/api/read-semantic-resource/validate-read-semantic-resource";
import type { ReadSemanticResourceResult } from "$capabilities/semantic-overlay/types/read-semantic-resource";

/** Returns the revisioned text and locator sidecar used by semantic translation. */
export const readSemanticResource = async (
  input: unknown
): Promise<ReadSemanticResourceResult> => {
  const scope = await requireScope();
  const asked = validateReadSemanticResource(input);
  return (
    await readSemanticResourceForModel(
      serverModel(),
      scope.projectId as Id<"projects">,
      asked.ref
    ) ?? null
  );
};
