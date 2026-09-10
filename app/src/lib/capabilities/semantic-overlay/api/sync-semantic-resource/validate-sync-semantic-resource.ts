import { semanticResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";
import type { SyncSemanticResourceInput } from "$capabilities/semantic-overlay/types/sync-semantic-resource";

export const validateSyncSemanticResource = (input: unknown): SyncSemanticResourceInput => {
  const candidate = semanticCommand(input, ["ref", "force"], "syncSemanticResource input");
  if (candidate.force !== undefined && typeof candidate.force !== "boolean") {
    throw new Error("syncSemanticResource force must be a boolean");
  }
  return {
    ref: semanticResourceRef(candidate.ref),
    ...(candidate.force === undefined ? {} : { force: candidate.force })
  };
};
