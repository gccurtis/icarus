import { defineTable } from "convex/server";
import { v } from "convex/values";
import { latticeWindowValidator } from "$knowledge/types/lattice-node";
import { latticeSourceValidator } from "$knowledge/types/lattice-source";
import { latticeStateValidator, rebuildReasonValidator } from "$knowledge/types/lattice-version";

/**
 * The width of every vector in the deployment, mirroring the `embedding`
 * binding's `dimensions` in `configuration/intelligence.yaml`.
 *
 * **A Convex vector index takes a literal**, so the number is fixed when the
 * schema is written rather than chosen per project — which is what "the
 * embedding model is pinned" means in practice. `latticeVersions.dimensions` is
 * the per-project record of what actually built that lattice, and a model whose
 * width disagrees with this one is a rebuild, not a migration.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * The lattice: level-0 windows, the clusters above them, the index-wide state,
 * and what has already been read out of each source.
 *
 * Nodes are derived and never authored, so nothing here is lost by discarding
 * and regenerating the lot — which is what makes re-windowing or re-embedding
 * with a different model an option rather than a data-loss event.
 */
export const knowledgeTables = {
  latticeNodes: defineTable({
    projectId: v.id("projects"),
    /** 0 = a window read from a source; above, a cluster of the level below. */
    level: v.number(),
    /** Set on source-tier nodes. Absent on corpus-tier ones, which span sources. */
    tierSourceId: v.optional(v.string()),
    /**
     * Whether this node has found a parent.
     *
     * **Stored rather than derived from `parentId` being absent, because it is
     * an index key.** `by_project_clustered` is asked at the start of every
     * clustering pass and every query — it is both the work remaining and
     * retrieval's frontier — and building the most frequent question in the
     * system on the *absence* of a field makes it the most expensive one.
     */
    clustered: v.boolean(),
    windows: v.array(latticeWindowValidator),
    /** Level 0 only. A cluster's text is recoverable from its windows. */
    text: v.optional(v.string()),
    /** Unit-normalized. At level 0, the window's own embedding. */
    centroid: v.array(v.float64()),
    count: v.optional(v.number()),
    /** The *weakest* pairwise similarity in the clique, never the mean. */
    cohesion: v.optional(v.number()),
    tokens: v.optional(v.number()),
    members: v.optional(v.array(v.id("latticeNodes"))),
    parentId: v.optional(v.id("latticeNodes")),
    staleAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_project_clustered", ["projectId", "clustered"])
    .index("by_project_level", ["projectId", "level"])
    // `projectId` leads even the two that read as parent-scoped: a read that
    // forgets the predicate reads every project's nodes, and the parent id
    // alone does not stop it.
    .index("by_parent", ["projectId", "parentId"])
    .index("by_tier_source", ["projectId", "tierSourceId"])
    .vectorIndex("by_centroid", {
      vectorField: "centroid",
      dimensions: EMBEDDING_DIMENSIONS,
      filterFields: ["projectId"]
    }),

  /**
   * One row per project, and the mutation is what makes that true — Convex has
   * no unique index. Two would mean two answers to "what does this project
   * know", with nothing to say which is right.
   */
  latticeVersions: defineTable({
    projectId: v.id("projects"),
    /** A counter over changes, not a content hash: ordering is what staleness needs. */
    version: v.number(),
    /** What the binding pointed at when this lattice was built. */
    embeddingModel: v.string(),
    /** The intelligence key it resolved from — `"embedding"`. */
    embeddingBinding: v.string(),
    dimensions: v.number(),
    /** 1 means level 0 exists and nothing is clustered yet. A normal state. */
    levelCount: v.number(),
    nodeCount: v.number(),
    nodesByLevel: v.array(v.number()),
    staleCount: v.number(),
    state: latticeStateValidator,
    error: v.optional(v.string()),
    rebuildReason: v.optional(rebuildReasonValidator),
    updatedAt: v.number()
  }).index("by_project", ["projectId"]),

  /**
   * The PCA basis and IVF cell centroids one level was clustered through, above
   * the exact/approximate crossover.
   *
   * **Entirely derived**, like everything else here: it can be dropped and
   * refitted from the persisted windows, which is what makes changing `pcaDims`,
   * `k`, or the cell count a rebuild rather than a migration.
   *
   * `threshold` and `k` sit beside the basis so an index fitted under other
   * parameters is recognizable rather than silently mixed with one that is not.
   */
  latticeLevelIndexes: defineTable({
    projectId: v.id("projects"),
    /** The deepest level in the pool the basis was fitted over. */
    level: v.number(),
    threshold: v.number(),
    /** Neighbours retained per artifact in the graph this level clustered over. */
    k: v.number(),
    /** Orthonormal rows. Empty when the pool's own width is already narrow enough. */
    basis: v.array(v.array(v.float64())),
    centroids: v.array(v.array(v.float64())),
    updatedAt: v.number()
  }).index("by_project_level", ["projectId", "level"]),

  /**
   * What has already been read out of each source.
   *
   * It exists so that ingesting an unchanged source can be skipped *entirely* —
   * the revision is compared before the text is windowed, which is the only
   * point at which skipping still saves the windowing and hashing rather than
   * only the embedding.
   */
  latticeSources: defineTable({
    projectId: v.id("projects"),
    source: latticeSourceValidator,
    /** The source's own revision at the moment it was last read. */
    revision: v.string(),
    windowCount: v.number(),
    indexedAt: v.number()
  }).index("by_project_source", ["projectId", "source.kind", "source.id"])
};
