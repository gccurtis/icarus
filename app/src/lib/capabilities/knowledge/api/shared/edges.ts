import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import type { LatticeNeighbour, LevelEdge } from "$knowledge/types/lattice-edge";

/** The algorithm sees strings; what goes into a row came out of the store. */
const asNodeId = (id: string) => id as Id<"latticeNodes">;

/**
 * A pair's row, from whichever end asks.
 *
 * One row per pair, so the columns have to be assigned by something that does
 * not depend on which end reported it — and ordering by id rather than by pool
 * position keeps that independent of the order rows came back in, which is the
 * same reason the pool is sorted before it is clustered.
 */
const ordered = (a: string, b: string) => (a < b ? { fromId: a, toId: b } : { fromId: b, toId: a });

const edgesFrom = async (
  ctx: QueryCtx,
  scope: Scope,
  nodeId: Id<"latticeNodes">,
  level?: number
) =>
  await ctx.db
    .query("latticeEdges")
    .withIndex("by_from_level", (q) => {
      const at = q.eq("projectId", scope.projectId).eq("fromId", nodeId);
      return level === undefined ? at : at.eq("level", level);
    })
    .collect();

const edgesTo = async (ctx: QueryCtx, scope: Scope, nodeId: Id<"latticeNodes">, level?: number) =>
  await ctx.db
    .query("latticeEdges")
    .withIndex("by_to_level", (q) => {
      const at = q.eq("projectId", scope.projectId).eq("toId", nodeId);
      return level === undefined ? at : at.eq("level", level);
    })
    .collect();

const touching = async (
  ctx: QueryCtx,
  scope: Scope,
  nodeId: Id<"latticeNodes">,
  level?: number
): Promise<Doc<"latticeEdges">[]> => [
  ...(await edgesFrom(ctx, scope, nodeId, level)),
  ...(await edgesTo(ctx, scope, nodeId, level))
];

/**
 * The nodes one node is related to, strongest first.
 *
 * **This is the whole reason there are two indexes.** A pair is one row, so half
 * of a node's neighbours are found in each column, and a query that read only
 * one would answer differently depending on which end of the pair was written
 * first.
 *
 * A level narrows it to one generation. Without one the answer spans every
 * generation the node has been compared in, which is what a walk of the network
 * around an orphan wants — it has been carried into every pool above it.
 */
export const neighbours = async (
  ctx: QueryCtx,
  scope: Scope,
  nodeId: Id<"latticeNodes">,
  level?: number
): Promise<LatticeNeighbour[]> =>
  (await touching(ctx, scope, nodeId, level))
    .map((edge) => ({
      nodeId: edge.fromId === nodeId ? edge.toId : edge.fromId,
      level: edge.level,
      weight: edge.weight
    }))
    .sort((left, right) => right.weight - left.weight || (left.nodeId < right.nodeId ? -1 : 1));

/**
 * Record what one pass found related, replacing what the last one did.
 *
 * **The pool's edges at that generation are re-derived, not added to.** A pair
 * the pass no longer relates has to stop being an edge, and there is no version
 * to compare — the pass that just ran is the answer.
 *
 * Both columns are cleared for every node in the pool, because which column
 * held a node is a property of its id rather than of anything the caller knows.
 * Other generations are untouched: each is its own network, and one is not a
 * correction of another.
 */
export const writeEdges = async (
  ctx: MutationCtx,
  scope: Scope,
  level: number,
  pool: readonly Id<"latticeNodes">[],
  edges: readonly LevelEdge[]
): Promise<void> => {
  const removed = new Set<string>();
  for (const nodeId of pool) {
    for (const edge of await touching(ctx, scope, nodeId, level)) {
      // A pair with both ends in the pool comes back twice, and Convex refuses
      // a second delete of one row.
      if (removed.has(edge._id)) continue;
      removed.add(edge._id);
      await ctx.db.delete(edge._id);
    }
  }

  for (const edge of edges) {
    const { fromId, toId } = ordered(edge.fromId, edge.toId);
    await ctx.db.insert("latticeEdges", {
      projectId: scope.projectId,
      level,
      fromId: asNodeId(fromId),
      toId: asNodeId(toId),
      weight: edge.weight
    });
  }
};

/**
 * Take a node's edges with the node.
 *
 * An edge outliving its endpoint is a claim about something that no longer
 * exists, and a neighbour query cannot notice that on its own — it would hand
 * back an id that reads as a node until someone loads it.
 */
export const dropEdges = async (
  ctx: MutationCtx,
  scope: Scope,
  nodeId: Id<"latticeNodes">
): Promise<void> => {
  for (const edge of await touching(ctx, scope, nodeId)) await ctx.db.delete(edge._id);
};
