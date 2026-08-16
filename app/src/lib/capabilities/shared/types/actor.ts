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
  v.object({ kind: v.literal("agent"), taskId: v.id("agentTasks") }),
  v.object({ kind: v.literal("automation"), automationId: v.string() }),
  v.object({ kind: v.literal("connector"), connectorId: v.string() }),
  v.object({ kind: v.literal("system") })
);

// The last two are `v.string()` because `v.id` names a table the schema must
// declare, and `automations` (needs scheduling) and `connectors` (needs OAuth,
// webhooks, provider sync) are pass 8. Each tightens with its table.

export type Actor = Infer<typeof actorValidator>;
