import { projectMutation, projectQuery } from "$convex/functions";
import { cluster as clusterLattice } from "$knowledge/api/cluster/cluster";
import { status as latticeStatus } from "$knowledge/api/status/status";

/**
 * The lattice's public surface — `api.capabilities.knowledge.*`.
 *
 * **Ingestion is missing on purpose.** Embedding is a network call and a Convex
 * mutation cannot make one: `ingest` is the transactional half of an action that
 * does not exist until the intelligence capability wires a provider. Registering
 * it now would mean a door that either fabricates an embedder or throws on every
 * call, and both read as a feature that is there.
 *
 * **Clustering is registered, and the difference is the reason why.** It reads
 * vectors that are already stored and writes rows; there is no provider in it,
 * so it is a mutation and nothing has to exist first.
 *
 * Retrieval is not here either — it arrives with descent, which needs the levels
 * this pass builds.
 */
export const status = projectQuery({
  args: {},
  handler: (ctx) => latticeStatus(ctx, ctx.scope)
});

export const cluster = projectMutation({
  args: {},
  handler: (ctx) => clusterLattice(ctx, ctx.scope)
});
