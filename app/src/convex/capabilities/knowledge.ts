import { projectQuery } from "$convex/functions";
import { status as latticeStatus } from "$knowledge/api/status/status";

/**
 * The lattice's public surface — `api.capabilities.knowledge.*`.
 *
 * **One function, and the missing one is deliberate.** Ingestion is not
 * registered because embedding is a network call and a Convex mutation cannot
 * make one: `ingest` is the transactional half of an action that does not exist
 * until the intelligence capability wires a provider. Registering it now would
 * mean a door that either fabricates an embedder or throws on every call, and
 * both read as a feature that is there.
 *
 * Retrieval is not here either — it arrives with descent, which needs levels
 * above 0 to descend.
 */
export const status = projectQuery({
  args: {},
  handler: (ctx) => latticeStatus(ctx, ctx.scope)
});
