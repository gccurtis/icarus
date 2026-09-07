import { semanticResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import type { SyncSemanticResourceInput } from "$capabilities/semantic-overlay/types/sync-semantic-resource";

export const validateSyncSemanticResource = (input: unknown): SyncSemanticResourceInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("syncSemanticResource input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find(
    (key) => key !== "ref" && key !== "force"
  );
  if (unexpected !== undefined) {
    throw new Error(`syncSemanticResource input has unexpected field '${unexpected}'`);
  }
  if (candidate.force !== undefined && typeof candidate.force !== "boolean") {
    throw new Error("syncSemanticResource force must be a boolean");
  }
  return {
    ref: semanticResourceRef(candidate.ref),
    ...(candidate.force === undefined ? {} : { force: candidate.force })
  };
};
