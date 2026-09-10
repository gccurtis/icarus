import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";
import type { EnqueueSemanticSyncInput } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";

export const validateEnqueueSemanticSync = (input: unknown): EnqueueSemanticSyncInput => {
  const candidate = semanticCommand(input, ["ref"], "enqueueSemanticSync input");
  return { ref: semanticIngestibleResourceRef(candidate.ref) };
};
