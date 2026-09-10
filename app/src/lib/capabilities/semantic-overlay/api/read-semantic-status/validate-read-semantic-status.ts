import { semanticIngestibleResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";
import type { ReadSemanticStatusInput } from "$capabilities/semantic-overlay/types/read-semantic-status";

export const validateReadSemanticStatus = (input: unknown): ReadSemanticStatusInput => {
  const candidate = semanticCommand(input, ["ref"], "readSemanticStatus input");
  return { ref: semanticIngestibleResourceRef(candidate.ref) };
};
