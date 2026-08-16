import type { Scope } from "$access/types/access";
import type { ActivityEntry, ActorLabel } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";

/**
 * An agent's label, which is three fields because an agent needs three.
 *
 * *Researcher · Gabriel Curtis · Q3 competitive scan* — the persona says what
 * kind of thing produced the work, the dispatcher says who is accountable for it
 * having happened at all, and the task's title says which job it was, since
 * several tasks run the same persona.
 *
 * **`onBehalfOf` names the dispatcher and changes nothing about attribution.**
 * The actor is still the task, and the dispatcher's undo stack is still
 * untouched; a label can afford to be generous precisely because it is never
 * what code compares.
 */
const agentLabel = async (
  ctx: MutationCtx,
  taskId: Id<"agentTasks">
): Promise<ActorLabel | undefined> => {
  const task = await ctx.db.get(taskId);
  if (!task) return undefined;

  const persona = task.personaId ? await ctx.db.get(task.personaId) : null;
  const dispatcher = task.origin.kind === "user" ? await ctx.db.get(task.origin.userId) : null;

  return {
    kind: "agent",
    name: persona?.name ?? "Agent",
    onBehalfOf: dispatcher?.displayName,
    detail: task.title
  };
};

/**
 * The display form to freeze into the entry.
 *
 * Resolved here rather than by the caller for the reason blank labels ship and
 * stay: a capability that has to remember to look a name up is a capability that
 * eventually does not. `user`, `system`, and `agent` are every kind this
 * deployment can construct today; `automation` and `connector` name tables that
 * arrive in pass 8, and each of those tasks moves its resolution into here.
 *
 * Until then their label has to come from the caller, and an entry with no
 * legible actor is refused rather than written. The caller is another
 * capability, never a client, so this is a programming error and failing the
 * mutation is how it gets found.
 */
const labelFor = async (
  ctx: MutationCtx,
  actor: Actor,
  given: ActorLabel | undefined
): Promise<ActorLabel> => {
  if (actor.kind === "user") {
    const user = await ctx.db.get(actor.userId);
    return { kind: actor.kind, name: user?.displayName ?? "A deleted user" };
  }
  if (actor.kind === "system") return { kind: actor.kind, name: "System" };
  if (actor.kind === "agent") {
    const resolved = await agentLabel(ctx, actor.taskId);
    if (resolved) return resolved;
  }
  if (given && given.name.length > 0) return given;
  throw new Error(`An activity entry by a ${actor.kind} must carry its actor label`);
};

/**
 * Appends one event to the project's log.
 *
 * **Not public, and that is the point.** It is called by the capability that did
 * the thing, inside the same transaction, so an entry cannot be absent from a
 * write that happened or present for one that did not. A log a client can write
 * to is not evidence of anything.
 *
 * `at` is stamped here rather than accepted, and a resolvable label is resolved
 * here rather than trusted, for one reason: a log whose contents come from
 * whoever is writing can be backdated and misattributed.
 */
export const record = async (
  ctx: MutationCtx,
  scope: Scope,
  entry: ActivityEntry
): Promise<void> => {
  const { actorLabel, ...event } = entry;

  await ctx.db.insert("activity", {
    projectId: scope.projectId,
    ...event,
    actorLabel: await labelFor(ctx, entry.actor, actorLabel),
    at: Date.now()
  });
};
