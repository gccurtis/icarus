import type { ReadSemanticResourceInput } from "$capabilities/semantic-overlay/types/read-semantic-resource";
import { semanticResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";

export const validateReadSemanticResource = (input: unknown): ReadSemanticResourceInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("readSemanticResource input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find((key) => key !== "ref");
  if (unexpected !== undefined) {
    throw new Error(`readSemanticResource input has unexpected field '${unexpected}'`);
  }
  return { ref: semanticResourceRef(candidate.ref) };
};
