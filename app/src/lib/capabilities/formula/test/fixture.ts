import type { Scope } from "$access/types/access";
import type { FormulaValue } from "$content/types/value";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { formulaRefusal } from "$formula/errors";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; nothing here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/** The caller: one user, one project, and the scope the gate would have produced. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const projectId = await ctx.db.insert("projects", {
    name: "Development",
    revision: 1,
    updatedAt: NOW
  });
  return { ctx, scope: scopeOf(projectId, userId), userId };
};

export const number = (value: number): FormulaValue => ({ kind: "number", value });
export const text = (value: string): FormulaValue => ({ kind: "text", value });
export const EMPTY: FormulaValue = { kind: "empty" };

/** The refusal a call produced — the payload, which is the only part Convex serializes. */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => formulaRefusal(error)
  );

/** The refusal a synchronous procedure produced. */
export const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return formulaRefusal(error);
  }
};
