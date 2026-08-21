import { v, type Infer } from "convex/values";

/**
 * Who did something. One type for every table that attributes anything.
 *
 * **The agent variant points at its task, not its persona.** The task already
 * carries `personaId`, so storing both would let them disagree, and the task is
 * the more specific truth about what acted. The same reasoning puts `connection`
 * here rather than `connector`: a connection reaches its connector, and a
 * connector cannot reach a file.
 *
 * **A persona replying in its own thread is not an actor here.** `Message.author`
 * is optional, and absent on a response means the thread's own responder — so
 * attributing a reply never requires inventing a unit of work nobody asked for.
 *
 * `system` carries no id because there is nothing to look up.
 *
 * **There is no `automation` variant.** Its table does not exist, and a variant
 * holding an id nothing can resolve is worse than an honest absence. Adding a
 * union member later is a widening change — every existing row still validates —
 * so it costs nothing to wait for the table.
 *
 * Per-variant field names rather than a uniform `id`, so each one is a real
 * `v.id(...)` against the table it names: Convex rejects an id belonging to the
 * wrong table at the door, and `db.get` is typed without a cast. Reading the
 * field requires knowing `kind`, which every consumer has already branched on.
 */
export const actorValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("agent"), taskId: v.id("agentTasks") }),
  v.object({ kind: v.literal("connection"), connectionId: v.id("connections") }),
  v.object({ kind: v.literal("system") })
);

export type Actor = Infer<typeof actorValidator>;
