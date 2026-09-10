import type { ReadSemanticResourceInput } from "$capabilities/semantic-overlay/types/read-semantic-resource";
import { semanticResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";

export const validateReadSemanticResource = (input: unknown): ReadSemanticResourceInput => {
  const candidate = semanticCommand(input, ["ref"], "readSemanticResource input");
  return { ref: semanticResourceRef(candidate.ref) };
};
