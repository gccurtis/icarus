import type { Scope } from "$access/types/access";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { messagesRefusal } from "$messages/errors";
import type { ThreadRef } from "$messages/types/thread";
import { fakeCtx } from "$shared/test/fake-ctx";
import type { Actor } from "$shared/types/actor";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/** The caller, and a project they are not asking about to put other people's turns in. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  const person: Actor = { kind: "user", userId: userId as unknown as Id<"users"> };

  return { ctx, userId, person, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

/** All three thread kinds, so a read proving isolation has something to be isolated from. */
export const research = (id: string): ThreadRef => ({
  kind: "research",
  id: id as Id<"researchThreads">
});
export const task = (id: string): ThreadRef => ({ kind: "task", id: id as Id<"agentTasks"> });
export const persona = (id: string): ThreadRef => ({
  kind: "persona",
  id: id as Id<"personaThreads">
});

/** What was said. One paragraph is enough to prove blocks round trip. */
export const said = (text: string): ContentBlock[] => [
  {
    id: "b1",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "b1a", kind: "literal", text }],
    display: text,
    marks: []
  }
];

/** What a turn reads as — the one thing a test needs back off a block. */
export const spoken = (blocks: ContentBlock[]): string | undefined =>
  blocks[0]?.type === "text" ? blocks[0].display : undefined;

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/not found/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => messagesRefusal(error)
  );
