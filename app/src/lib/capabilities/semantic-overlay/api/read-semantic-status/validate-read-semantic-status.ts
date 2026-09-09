import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import type { ReadSemanticStatusInput } from "$capabilities/semantic-overlay/types/read-semantic-status";

export const validateReadSemanticStatus = (input: unknown): ReadSemanticStatusInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("readSemanticStatus input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find((key) => key !== "ref");
  if (unexpected !== undefined) {
    throw new Error(`readSemanticStatus input has unexpected field '${unexpected}'`);
  }
  return { ref: semanticIngestibleResourceRef(candidate.ref) };
};
