import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { personaThreadsRefusal } from "$persona-threads/errors";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

const personaIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string | undefined,
  name: string
) =>
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
 * The caller, a project they are not asking about, and a persona in each — plus
 * one belonging to every project, which is the case a chat has to work with.
 */
export const chatting = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  return {
    ctx,
    userId,
    scope: scopeOf(mine, userId),
    elsewhere: scopeOf(theirs, userId),
    persona: await personaIn(ctx, mine, "Researcher"),
    everyonesPersona: await personaIn(ctx, undefined, "Everyone's"),
    theirPersona: await personaIn(ctx, theirs, "Theirs")
  };
};

/** A thread already in progress, written straight to the table. */
export const threadIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  personaId: Id<"personas">,
  title = "Q3 margin"
) =>
  (await ctx.db.insert("personaThreads", {
    projectId,
    personaId,
    title,
    createdBy: { kind: "system" },
    updatedAt: NOW
  })) as Id<"personaThreads">;

/** A turn in that thread, so branching has a point to continue from. */
export const saidIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  threadId: Id<"personaThreads">,
  text: string
) =>
  (await ctx.db.insert("messages", {
    projectId,
    thread: { kind: "persona", id: threadId },
    role: "prompt",
    blocks: [
      {
        id: "b1",
        type: "text",
        variant: "paragraph",
        atoms: [{ id: "b1a", kind: "literal", text }],
        display: text,
        marks: []
      }
    ],
    author: { kind: "system" },
    state: "complete"
  })) as Id<"messages">;

/** Every row of a table, as stored — what an "unchanged" assertion compares. */
export const rowsOf = (
  ctx: ReturnType<typeof fakeCtx>,
  table: string
): Record<string, unknown>[] =>
  [...ctx.rows.entries()]
    .filter(([, row]) => row._table === table)
    .map(([id, row]) => ({ id, ...row }));

/** The turns stored against one thread, which is what "copied nothing" reads. */
export const messagesIn = (ctx: ReturnType<typeof fakeCtx>, threadId: Id<"personaThreads">) =>
  rowsOf(ctx, "messages").filter(
    (row) => (row.thread as { id?: string } | undefined)?.id === threadId
  );

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches /not found/ here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => personaThreadsRefusal(error)
  );
