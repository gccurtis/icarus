import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { readSemanticStatusFor } from "$capabilities/semantic-overlay/api/shared/status";
import { validateReadSemanticStatus } from "$capabilities/semantic-overlay/api/read-semantic-status/validate-read-semantic-status";
import type { ReadSemanticStatusResult } from "$capabilities/semantic-overlay/types/read-semantic-status";

/** Projects job/publication state without exposing vectors, native text, or raw rows. */
export const readSemanticStatus = async (input: unknown): Promise<ReadSemanticStatusResult> => {
  const scope = await requireScope();
  const asked = validateReadSemanticStatus(input);
  return readSemanticStatusFor(
    serverModel(),
    scope.projectId as Id<"projects">,
    asked.ref
  );
};
