import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { KnowledgeError } from "$knowledge/errors";
import type { Embedding } from "$knowledge/types/embedding";
import type { LatticeVersion, RebuildReason } from "$knowledge/types/lattice-version";

/** The project's lattice version row, or nothing if it has never been indexed. */
export const readVersion = async (
  ctx: QueryCtx,
  scope: Scope
): Promise<Doc<"latticeVersions"> | null> =>
  await ctx.db
    .query("latticeVersions")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .first();

/**
 * Whether the lattice was built with something other than what is bound now.
 *
 * **This is what storing both the binding and the resolved model buys.** The
 * binding can be repointed at any time and the lattice does not follow;
 * comparing the stored model against what the key resolves to today is the only
 * way that is caught rather than silently producing meaningless distances.
 *
 * Renaming the binding is not drift. The binding says where to look when this
 * needs fixing; what makes two vectors comparable is the model and its width.
 */
export const embeddingDrift = (
  version: Pick<LatticeVersion, "embeddingModel" | "dimensions">,
  embedding: Embedding
): RebuildReason | undefined =>
  version.embeddingModel !== embedding.model || version.dimensions !== embedding.dimensions
    ? "embedding_changed"
    : undefined;

/**
 * The project's lattice version, created on first use.
 *
 * **One row per project, and this function is what makes that true.** Convex has
 * no unique index, so the invariant is a read-then-insert inside a serializable
 * transaction: a concurrent insert invalidates this read set and the mutation
 * re-runs against the row that won. No version field, no retry loop — and no
 * second code path, because a second insert anywhere else breaks it in silence.
 *
 * It refuses rather than adopting a drifted binding. Mixing vectors from two
 * models into one index does not degrade the answers, it makes the distances
 * mean nothing, and the fix is a rebuild rather than another write.
 */
export const ensureVersion = async (
  ctx: MutationCtx,
  scope: Scope,
  embedding: Embedding
): Promise<Doc<"latticeVersions">> => {
  const existing = await readVersion(ctx, scope);
  if (existing) {
    const drift = embeddingDrift(existing, embedding);
    if (drift) {
      throw new KnowledgeError(
        "embedding-changed",
        `The '${embedding.binding}' binding now resolves to ${embedding.model}, but this lattice was built with ${existing.embeddingModel} — rebuild it`
      );
    }
    return existing;
  }

  const id = await ctx.db.insert("latticeVersions", {
    projectId: scope.projectId,
    version: 1,
    embeddingModel: embedding.model,
    embeddingBinding: embedding.binding,
    dimensions: embedding.dimensions,
    // Level 0 exists the moment anything is ingested and nothing above it does
    // until a clustering pass runs. That is the normal state, not a failure.
    levelCount: 1,
    nodeCount: 0,
    nodesByLevel: [0],
    staleCount: 0,
    state: "ready",
    updatedAt: Date.now()
  });

  const created = await ctx.db.get(id);
  if (!created) throw new Error("The lattice version vanished between insert and read");
  return created;
};

/**
 * Records what a pass left behind, and moves the version on.
 *
 * The counts are maintained rather than computed because they draw a readiness
 * badge on every project view, and counting rows to draw a badge means scanning
 * the lattice. They are approximate by nature and corrected on rebuild.
 */
export const advanceVersion = async (
  ctx: MutationCtx,
  id: Id<"latticeVersions">,
  counts: { nodesByLevel: number[]; staleCount: number }
): Promise<Doc<"latticeVersions">> => {
  await ctx.db.patch(id, {
    version: ((await ctx.db.get(id))?.version ?? 0) + 1,
    levelCount: counts.nodesByLevel.length,
    nodeCount: counts.nodesByLevel.reduce((total, count) => total + count, 0),
    nodesByLevel: counts.nodesByLevel,
    staleCount: counts.staleCount,
    updatedAt: Date.now()
  });

  const advanced = await ctx.db.get(id);
  if (!advanced) throw new Error("The lattice version vanished between patch and read");
  return advanced;
};
