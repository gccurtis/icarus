import { v, type Infer } from "convex/values";

/**
 * Who did something. One type for every table that attributes anything.
 *
 * An agent variant points at its *task*, not its persona: the task already
 * carries `personaId`, so storing both would let them disagree, and the task is
 * the more specific truth about what acted.
 *
 * `system` carries no id because there is nothing to look up.
 */
export const actorValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("agent"), taskId: v.string() }),
  v.object({ kind: v.literal("automation"), automationId: v.string() }),
  v.object({ kind: v.literal("connector"), connectorId: v.string() }),
  v.object({ kind: v.literal("system") })
);

// The three are `v.string()` only because `agentTasks`, `automations`, and
// `connectors` do not exist until passes 7 and 8. Each tightens to `v.id(...)`
// in the task that creates its table.

export type Actor = Infer<typeof actorValidator>;
