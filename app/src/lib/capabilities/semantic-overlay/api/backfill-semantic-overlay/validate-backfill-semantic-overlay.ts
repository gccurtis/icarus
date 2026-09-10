import type { BackfillSemanticOverlayInput } from "$capabilities/semantic-overlay/types/semantic-sync-queue";
import { semanticCommand } from "$capabilities/semantic-overlay/api/shared/command-input";

export const validateBackfillSemanticOverlay = (
  input: unknown
): Required<BackfillSemanticOverlayInput> => {
  const candidate = semanticCommand(input, ["force", "limit"], "backfillSemanticOverlay input");
  if (candidate.force !== undefined && typeof candidate.force !== "boolean") {
    throw new Error("backfillSemanticOverlay force must be a boolean");
  }
  const limit = candidate.limit ?? 50;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 50) {
    throw new Error("backfillSemanticOverlay limit must be an integer from 1 through 50");
  }
  return { force: candidate.force === true, limit: limit as number };
};
