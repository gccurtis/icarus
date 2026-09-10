import type { ProcessSemanticSyncQueueInput } from "$capabilities/semantic-overlay/types/semantic-sync-queue";
import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";

export const validateProcessSemanticSyncQueue = (
  input: unknown
): { limit: number; ref?: ProcessSemanticSyncQueueInput["ref"] } => {
  const candidate = semanticCommand(input, ["limit", "ref"], "processSemanticSyncQueue input");
  const limit = candidate.limit ?? 10;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 50) {
    throw new Error("processSemanticSyncQueue limit must be an integer from 1 through 50");
  }
  return {
    limit: limit as number,
    ...(candidate.ref === undefined ? {} : { ref: semanticIngestibleResourceRef(candidate.ref) })
  };
};
