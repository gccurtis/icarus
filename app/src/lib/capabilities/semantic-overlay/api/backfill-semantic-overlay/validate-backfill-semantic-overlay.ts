import type { BackfillSemanticOverlayInput } from "$capabilities/semantic-overlay/types/semantic-sync-queue";

export const validateBackfillSemanticOverlay = (
  input: unknown
): Required<BackfillSemanticOverlayInput> => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("backfillSemanticOverlay input must be an object");
  }
  const candidate = input as Record<string, unknown>;
  const unexpected = Object.keys(candidate).find(
    (key) => key !== "force" && key !== "limit"
  );
  if (unexpected !== undefined) {
    throw new Error(`backfillSemanticOverlay input has unexpected field '${unexpected}'`);
  }
  if (candidate.force !== undefined && typeof candidate.force !== "boolean") {
    throw new Error("backfillSemanticOverlay force must be a boolean");
  }
  const limit = candidate.limit ?? 50;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 50) {
    throw new Error("backfillSemanticOverlay limit must be an integer from 1 through 50");
  }
  return { force: candidate.force === true, limit: limit as number };
};
