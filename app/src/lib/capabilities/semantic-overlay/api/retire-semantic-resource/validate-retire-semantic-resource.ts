import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import type { RetireSemanticResourceInput } from "$capabilities/semantic-overlay/types/retire-semantic-resource";

export const validateRetireSemanticResource = (input: unknown): RetireSemanticResourceInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("retireSemanticResource input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find((key) => key !== "ref");
  if (unexpected !== undefined) {
    throw new Error(`retireSemanticResource input has unexpected field '${unexpected}'`);
  }
  return { ref: semanticIngestibleResourceRef(candidate.ref) };
};
