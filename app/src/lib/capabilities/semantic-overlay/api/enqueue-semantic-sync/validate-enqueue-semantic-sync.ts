import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import type { EnqueueSemanticSyncInput } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";

export const validateEnqueueSemanticSync = (input: unknown): EnqueueSemanticSyncInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("enqueueSemanticSync input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find((key) => key !== "ref");
  if (unexpected !== undefined) {
    throw new Error(`enqueueSemanticSync input has unexpected field '${unexpected}'`);
  }
  return { ref: semanticIngestibleResourceRef(candidate.ref) };
};
