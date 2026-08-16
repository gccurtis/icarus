import type { Scope } from "$access/types/access";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { researchLinksRefusal } from "$research-links/errors";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

type Fake = ReturnType<typeof fakeCtx>;

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

/**
 * The rows an edge hangs between, seeded straight into the fake db.
 *
 * Written here rather than through the owning capabilities' mutations: what a
 * link needs from an endpoint is that it exists, sits in the project, and has a
 * label — three columns, and going through `create` would tie these tests to
 * three other capabilities' arguments.
 */
const endpoint =
  (table: string, labelField: string) => async (ctx: Fake, scope: Scope, label: string) =>
    await ctx.db.insert(table, {
      projectId: (scope as unknown as { projectId: string }).projectId,
      [labelField]: label
    });

export const finding = endpoint("findings", "title");
export const hypothesis = endpoint("hypotheses", "statement");
export const question = endpoint("questions", "text");

/** Every edge in the fake db, whatever project it belongs to. */
export const storedLinks = (ctx: Fake) =>
  [...ctx.rows.values()].filter((row) => row._table === "researchLinks");

/**
 * What a handler asked the database for, index by index.
 *
 * The fake's `withIndex` ignores the name it is given, so a handler reading the
 * whole table by hand would pass every assertion about *results*. This records
 * the reads themselves, which is how "one indexed read" is checked at all.
 */
export const indexReads = (ctx: Fake): string[] => {
  const used: string[] = [];
  const query = ctx.db.query;
  ctx.db.query = (table: string) => {
    const chain = query(table);
    return {
      ...chain,
      withIndex: (name: string, fn?: (q: unknown) => unknown) => {
        used.push(`${table}.${name}`);
        return chain.withIndex(name, fn);
      }
    };
  };
  return used;
};

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/duplicate/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => researchLinksRefusal(error)
  );
