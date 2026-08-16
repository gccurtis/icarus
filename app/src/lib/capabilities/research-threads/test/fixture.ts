import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { researchThreadsRefusal } from "$research-threads/errors";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/** Something to anchor to, in whichever project is asked for. */
const anchorsIn = async (ctx: ReturnType<typeof fakeCtx>, projectId: string) => ({
  questionId: (await ctx.db.insert("questions", {
    projectId,
    text: "Why did margin fall?",
    notes: [],
    status: "open",
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"questions">,
  hypothesisId: (await ctx.db.insert("hypotheses", {
    projectId,
    statement: "Input costs rose",
    rationale: [],
    assessment: "untested",
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"hypotheses">
});

/** The caller, a project they are not asking about, and an anchor in each. */
export const researching = async () => {
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
    here: await anchorsIn(ctx, mine),
    there: await anchorsIn(ctx, theirs)
  };
};

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
    (error: unknown) => researchThreadsRefusal(error)
  );
