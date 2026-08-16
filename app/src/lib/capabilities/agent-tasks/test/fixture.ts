import type { Scope } from "$access/types/access";
import { agentTasksRefusal } from "$agent-tasks/errors";
import type { AgentTaskStatus } from "$agent-tasks/types/agent-task";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

const personaIn = async (ctx: ReturnType<typeof fakeCtx>, projectId: string, name: string) =>
  (await ctx.db.insert("personas", {
    projectId,
    name,
    definition: {
      focus: name,
      background: "",
      approach: "",
      outputPreferences: "",
      verification: ""
    },
    tools: [],
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"personas">;

/**
 * The person dispatching, a project they are not asking about, and a persona in
 * each — plus a chat with a turn in it, which is what a task branches from.
 */
export const dispatching = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });
  const persona = await personaIn(ctx, mine, "Researcher");
  const threadId = (await ctx.db.insert("personaThreads", {
    projectId: mine,
    personaId: persona,
    title: "Q3 margin",
    createdBy: { kind: "system" },
    updatedAt: NOW
  })) as Id<"personaThreads">;

  return {
    ctx,
    userId: userId as Id<"users">,
    scope: scopeOf(mine, userId),
    elsewhere: scopeOf(theirs, userId),
    persona,
    theirPersona: await personaIn(ctx, theirs, "Theirs"),
    threadId,
    messageId: await saidIn(ctx, mine, threadId)
  };
};

/** A turn of a chat, so a branch point has something to agree with. */
export const saidIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  threadId: Id<"personaThreads">
) =>
  (await ctx.db.insert("messages", {
    projectId,
    thread: { kind: "persona", id: threadId },
    role: "prompt",
    blocks: [],
    author: { kind: "system" },
    state: "complete"
  })) as Id<"messages">;

/** A task already dispatched, written straight to the table. */
export const taskIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  fields: {
    status?: AgentTaskStatus;
    title?: string;
    personaId?: Id<"personas">;
    origin?: Record<string, unknown>;
    startedAt?: number;
  } = {}
) =>
  (await ctx.db.insert("agentTasks", {
    projectId,
    title: fields.title ?? "Q3 competitive scan",
    prompt: "Scan the market for pricing moves since April.",
    personaId: fields.personaId,
    status: fields.status ?? "draft",
    origin: fields.origin ?? { kind: "system" },
    startedAt: fields.startedAt,
    updatedAt: NOW
  })) as Id<"agentTasks">;

/** Every row of a table, as stored — what an "unchanged" assertion compares. */
export const rowsOf = (
  ctx: ReturnType<typeof fakeCtx>,
  table: string
): Record<string, unknown>[] =>
  [...ctx.rows.entries()]
    .filter(([, row]) => row._table === table)
    .map(([id, row]) => ({ id, ...row }));

/**
 * The change sets one person's undo could reach.
 *
 * Undo reverts sets where `actor.kind === "user"` and the user is the person
 * undoing — the selector stated in
 * [actor](../../../../../../docs/data-models/core/actor.md#undo-scopes-on-the-actor).
 * Nothing implements it yet, so a test asks the question the same way it will.
 */
export const undoableBy = (ctx: ReturnType<typeof fakeCtx>, userId: Id<"users">) =>
  rowsOf(ctx, "changeSets").filter((set) => {
    const actor = set.actor as { kind: string; userId?: string };
    return actor.kind === "user" && actor.userId === userId;
  });

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches /not found/ here and still
 * reaches the caller as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => agentTasksRefusal(error)
  );
