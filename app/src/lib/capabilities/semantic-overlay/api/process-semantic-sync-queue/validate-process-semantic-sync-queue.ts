import type { ProcessSemanticSyncQueueInput } from "$capabilities/semantic-overlay/types/semantic-sync-queue";
import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

export const validateProcessSemanticSyncQueue = (
  input: unknown
): { limit: number; ref?: ProcessSemanticSyncQueueInput["ref"] } => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("processSemanticSyncQueue input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find(
    (key) => key !== "limit" && key !== "ref"
  );
  if (unexpected !== undefined) {
    throw new Error(`processSemanticSyncQueue input has unexpected field '${unexpected}'`);
  }
  const limit = candidate.limit ?? 10;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 50) {
    throw new Error("processSemanticSyncQueue limit must be an integer from 1 through 50");
  }
  return {
    limit: limit as number,
    ...(candidate.ref === undefined ? {} : { ref: semanticIngestibleResourceRef(candidate.ref) })
  };
};
