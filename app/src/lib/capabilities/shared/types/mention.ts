import { v, type Infer } from "convex/values";

/**
 * Who a remark is addressed to — `Actor`'s mirror image, and deliberately not the
 * same union.
 *
 * **You mention a persona; the thing that acts is a task.** A persona is a durable
 * identity you can talk to, a task is one run of it, so the addressable set and
 * the acting set overlap without matching. A task is mentionable too, which is how
 * you say something to work already in progress.
 *
 * `automation`, `connector`, and `system` have no case: they are things that
 * happen, not things you talk to.
 */
export const mentionValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("persona"), personaId: v.string() }),
  v.object({ kind: v.literal("task"), taskId: v.string() })
);

// `personaId` and `taskId` are `v.string()` only because `personas` and
// `agentTasks` arrive in passes 5 and 7; each tightens to `v.id(...)` there.

export type Mention = Infer<typeof mentionValidator>;
