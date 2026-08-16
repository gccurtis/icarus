import type { Scope } from "$access/types/access";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { touchedBy } from "$revisions/api/submit/check";
import { revisionsRefusal } from "$revisions/errors";
import type { Op } from "$revisions/types/change";
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
  const projectId = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  return { ctx, scope: scopeOf(projectId, userId), userId, projectId };
};

/** The one resource these tests edit — the ladder never knows more than the pair. */
export const RESOURCE = { resourceType: "document", resourceId: "documents:1" } as const;

/**
 * A change set that already landed: the window the ladder reads.
 *
 * `touched` is derived here exactly as `submit` derives it, because a window row
 * whose `touched` disagreed with its own ops would test a state nothing writes.
 */
export const landed = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  revision: number,
  ops: Op[]
) =>
  await ctx.db.insert("changeSets", {
    projectId,
    ...RESOURCE,
    revision,
    baseRevision: revision - 1,
    tier: "recent",
    ops,
    touched: touchedBy(ops),
    actor: { kind: "system" },
    at: NOW
  });

/** The change set stored at a revision, found the way a reader would rather than by insertion id. */
export const setAt = (ctx: ReturnType<typeof fakeCtx>, revision: number) =>
  [...ctx.rows.values()].find((row) => row._table === "changeSets" && row.revision === revision);

export const setsStored = (ctx: ReturnType<typeof fakeCtx>) =>
  [...ctx.rows.values()].filter((row) => row._table === "changeSets");

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message: it is the only part Convex serializes, so
 * a rejection thrown as a plain `Error` reaches a client as an opaque fault and
 * tells it nothing about which rung refused or what to do next.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => revisionsRefusal(error)
  );
