import type { RebuildSemanticIndexInput } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";

export const validateRebuildSemanticIndex = (input: unknown): RebuildSemanticIndexInput => {
  semanticCommand(input, [], "semantic index rebuild input");
  return {};
};
