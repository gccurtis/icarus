import { describe, expect, it } from "vitest";
import { resolveScope } from "$access/api/shared/resolve-scope";
import { accessRefusal } from "$access/errors";
import { DEVELOPMENT_SUBJECT } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { fakeCtx } from "$shared/test/fake-ctx";

/**
 * The only thing standing between a project token in a payload and that
 * project's rows, so the refusals are asserted as hard as the resolution: a
 * token belonging to someone else must be indistinguishable from one belonging
 * to nobody, or holding a leaked token confirms the project exists.
 */

const NOW = 1_700_000_000_000;

/** The fake `db` is structural. `resolveScope` touches nothing else on a ctx. */
const asQueryCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as QueryCtx;

/** The caller every test asks as — the one identity `resolveScope` stubs in. */
const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: DEVELOPMENT_SUBJECT,
    displayName: "Development User",
    updatedAt: NOW
  });
  return { ctx, userId };
};

const refusalFor = async (ctx: ReturnType<typeof fakeCtx>, token: string) =>
  await resolveScope(asQueryCtx(ctx), token).then(
    () => undefined,
    (error: unknown) => accessRefusal(error)
  );

describe("resolveScope", () => {
  it("refuses a token no membership stands behind", async () => {
    const { ctx } = await asking();

    expect(await refusalFor(ctx, "dev-project")).toMatchObject({ code: "no-such-project" });
  });

  it("refuses another user's token in the same words", async () => {
    const { ctx } = await asking();
    const otherUserId = await ctx.db.insert("users", {
      authSubject: "someone-else",
      displayName: "Someone Else",
      updatedAt: NOW
    });
    const projectId = await ctx.db.insert("projects", {
      name: "Theirs",
      revision: 1,
      updatedAt: NOW
    });
    await ctx.db.insert("memberships", {
      userId: otherUserId,
      projectId,
      token: "theirs",
      role: "owner"
    });

    const leaked = await refusalFor(ctx, "theirs");
    expect(leaked).toMatchObject({ code: "no-such-project" });
    expect(leaked).toEqual(await refusalFor(ctx, "never-issued"));
  });

  it("resolves a token the asking user holds to that membership's project", async () => {
    const { ctx, userId } = await asking();
    const projectId = await ctx.db.insert("projects", {
      name: "Development",
      revision: 1,
      updatedAt: NOW
    });
    await ctx.db.insert("memberships", { userId, projectId, token: "mine", role: "owner" });

    expect(await resolveScope(asQueryCtx(ctx), "mine")).toEqual({ projectId, userId });
  });
});
