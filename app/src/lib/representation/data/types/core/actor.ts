import type { Id } from "$representation/data/types/core/id";

/**
 * Who did something.
 *
 * The agent variant points at its task, not its persona: the task carries
 * `personaId`, so storing both would let them disagree. `system` has no id.
 */
export type Actor =
  | { kind: "user"; userId: Id<"users"> }
  | { kind: "agent"; taskId: Id<"agentTasks"> }
  | { kind: "connector"; connectorId: Id<"connectors"> }
  | { kind: "system" };
