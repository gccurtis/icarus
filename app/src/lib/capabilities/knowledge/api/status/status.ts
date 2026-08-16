import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { readVersion } from "$knowledge/api/shared/version";
import type { LatticeVersion } from "$knowledge/types/lattice-version";

/**
 * What the project's lattice is, or nothing if it has none.
 *
 * **Nothing is not a refusal.** A project nobody has written in yet has no
 * lattice, and so does one whose first ingest has not run; both are ordinary,
 * and an error would make a readiness badge into an incident.
 *
 * The counts are read off the row rather than counted, which is the reason they
 * are maintained: this renders on every project view, and counting rows to draw
 * a badge would scan the lattice on every subscription update.
 */
export const status = async (ctx: QueryCtx, scope: Scope): Promise<LatticeVersion | null> => {
  const version = await readVersion(ctx, scope);
  if (!version) return null;

  return {
    version: version.version,
    embeddingModel: version.embeddingModel,
    embeddingBinding: version.embeddingBinding,
    dimensions: version.dimensions,
    levelCount: version.levelCount,
    nodeCount: version.nodeCount,
    nodesByLevel: version.nodesByLevel,
    staleCount: version.staleCount,
    state: version.state,
    error: version.error,
    rebuildReason: version.rebuildReason,
    updatedAt: version.updatedAt
  };
};
