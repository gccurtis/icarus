import type { RebuildSemanticIndexInput } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

export const validateRebuildSemanticIndex = (input: unknown): RebuildSemanticIndexInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("semantic index rebuild input must be an object");
  }
  if (Object.keys(input).length > 0) {
    throw new Error("semantic index rebuild input has no fields");
  }
  return {};
};
