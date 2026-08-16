import type { Scope } from "$access/types/access";
import type { ContentBlock } from "$content/types/block";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { questionsRefusal } from "$questions/errors";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/** The caller, and a project they are not asking about to put other people's rows in. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  return { ctx, userId, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

/** The context around a question. One paragraph is enough to prove it round trips. */
export const notes = (text: string): ContentBlock[] => [
  {
    id: "n1",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "n1a", kind: "literal", text }],
    display: text,
    marks: []
  }
];

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/stale/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => questionsRefusal(error)
  );
