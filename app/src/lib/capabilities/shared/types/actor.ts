import { v, type Infer } from "convex/values";

/**
 * Who did something. One type for every table that attributes anything.
 *
 * **A task acts when work is tracked; a persona acts when it is talking.** A
 * task variant points at the run rather than the persona behind it — the task
 * already carries `personaId`, so storing both would let them disagree, and the
 * run is the more specific truth about what acted. But a persona answering in
 * its own chat is *not* a task: there is no run, no goal and no plan, and
 * forcing one into existence to attribute a reply would invent a unit of work
 * nobody asked for.
 *
 * **`automation` and `connector` are not here.** Their tables do not exist, and
 * a variant holding an unvalidated id that nothing can resolve is worse than an
 * honest absence. They return with their tables, if they need to at all.
 *
 * `system` carries no id because there is nothing to look up.
 */
export const actorValidator = v.union(
  v.object({ kind: v.literal("user"), id: v.string() }),
  v.object({ kind: v.literal("task"), id: v.string() }),
  v.object({ kind: v.literal("persona"), id: v.string() }),
  v.object({ kind: v.literal("system") })
);

// Every variant is `{ kind, id }` rather than `userId` / `taskId`. Per-variant
// names made one shape read four ways for no gain, and this matches
// `ResourceRef`, so one accessor works on both.
//
// The id is `v.string()`, not `v.id(...)`: tables land in stages, and typing an
// id against a table that does not exist yet means loosening it and
// re-tightening it across dozens of files for a check that only ever held inside
// one deployment.

export type Actor = Infer<typeof actorValidator>;
