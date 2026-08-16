import { v, type Infer } from "convex/values";
import { latticeSourceValidator } from "$knowledge/types/lattice-source";
import { rebuildReasonValidator } from "$knowledge/types/lattice-version";
import { resourceTypeValidator } from "$revisions/types/change";

/**
 * Why the lattice moved.
 *
 * **A `resource` cause carries the change-set revision it followed**, and that
 * is what makes the lattice explicable: a lattice state and a document state
 * can be lined up — *lattice version 214 reflects document revision 47* — and
 * the gap between a resource's current revision and the one the lattice last
 * indexed becomes a subtraction. Without it a stale retrieval result is
 * unattributable: you can see the lattice is behind, not what it is behind.
 *
 * The other four have no such number. A file, a finding, and a connector sync
 * carry no change-set sequence, and a rebuild followed nothing at all — it
 * carries the reason it was ordered, in the same vocabulary the version row
 * records a rebuild under.
 *
 * `connectorId` is a string because connectors arrive in pass 8. It becomes
 * `v.id("connectors")` with the table.
 */
export const latticeCauseValidator = v.union(
  v.object({
    kind: v.literal("resource"),
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    revision: v.number()
  }),
  v.object({ kind: v.literal("file"), fileId: v.id("externalFiles") }),
  v.object({ kind: v.literal("connector_sync"), connectorId: v.string() }),
  v.object({ kind: v.literal("finding"), findingId: v.id("findings") }),
  v.object({ kind: v.literal("rebuild"), reason: rebuildReasonValidator })
);

export type LatticeCause = Infer<typeof latticeCauseValidator>;

/**
 * What one source contributed to one change.
 *
 * **Added and removed, never modified.** A node's identity is its content and
 * its embedding together, so changing the text means a different vector, which
 * is a different point in the index, which is a different node. Calling it a
 * modification would imply the node persists across the change, and nothing
 * about it does.
 *
 * `unchanged` is a count. A small edit to a large document leaves most of its
 * passages untouched, and listing thousands of ids to say "these were fine"
 * would make the change row larger than the change.
 */
export const latticeNodeSetValidator = v.object({
  source: latticeSourceValidator,
  added: v.array(v.id("latticeNodes")),
  removed: v.array(v.id("latticeNodes")),
  unchanged: v.number()
});

export type LatticeNodeSet = Infer<typeof latticeNodeSetValidator>;

/**
 * One entry in the lattice's history: what moved, why, and how far up.
 *
 * **One row per change, holding a node set per source.** A connector sync brings
 * in forty files and a rebuild touches every source, so grouping by the cause
 * rather than by the source keeps the causal unit intact — "these four hundred
 * nodes appeared because of that sync" is one row, which is both how a person
 * reads it and how it is undone.
 *
 * `reclustered` is a count per level, indexed by level. A source change cascades
 * upward, so listing every id touched would make the row larger than the change
 * and be read by nobody; how far up the edit reached is the question.
 */
export type LatticeChange = {
  /** The lattice version this change produced. */
  readonly version: number;
  readonly cause: LatticeCause;
  readonly nodeSets: readonly LatticeNodeSet[];
  readonly reclustered?: readonly number[];
  readonly at: number;
};
