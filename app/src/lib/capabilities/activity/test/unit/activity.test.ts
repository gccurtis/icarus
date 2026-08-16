import { describe, expect, it } from "vitest";
import type { Scope } from "$access/types/access";
import { list } from "$activity/api/list/list";
import { record } from "$activity/api/shared/record";
import { activityTables } from "$activity/schema";
import type { ActivityEntry } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { fakeCtx } from "$shared/test/fake-ctx";

/**
 * The log is evidence, so the assertions are about what a writer cannot do to
 * it: no index that reads another project's rows, and no label or timestamp that
 * arrives from whoever is writing.
 */
describe("activity schema", () => {
  it("leads every index with projectId", () => {
    const indexes = activityTables.activity[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("stores the resolved label beside the actor", () => {
    const fields = activityTables.activity.validator.fields;

    expect(fields).toHaveProperty("actor");
    expect(Object.keys(fields.actorLabel.fields).sort()).toEqual(
      ["detail", "kind", "name", "onBehalfOf"].sort()
    );
  });

  it("gives a target an id and a label that outlives it", () => {
    const target = activityTables.activity.validator.fields.target;

    expect(Object.keys(target.fields).sort()).toEqual(["id", "label", "type"].sort());
  });

  it("holds what happened and nothing a reader has to join for", () => {
    const fields = Object.keys(activityTables.activity.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "actor", "actorLabel", "verb", "target", "context", "detail", "at"].sort()
    );
  });
});

/** The fake `db` is structural; neither handler touches anything else on a ctx. */
const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

const projectNamed = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  await ctx.db.insert("projects", { name, revision: 1, updatedAt: NOW });

/** The caller: one user, one project, and the scope the gate would have produced. */
const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  return { ctx, scope: scopeOf(await projectNamed(ctx, "Development"), userId), userId };
};

const entryBy = (userId: string, verb: string): ActivityEntry => ({
  actor: { kind: "user", userId: userId as Id<"users"> },
  verb,
  target: { type: "document", id: "documents:1", label: "Q3 plan" }
});

describe("record", () => {
  it("stamps `at` itself and ignores one the caller passes", async () => {
    const { ctx, scope, userId } = await asking();
    const before = Date.now();

    await record(asCtx(ctx), scope, { ...entryBy(userId, "created"), at: 0 } as ActivityEntry);

    expect(ctx.log[0].at).not.toBe(0);
    expect(ctx.log[0].at as number).toBeGreaterThanOrEqual(before);
  });

  it("resolves a user's label itself and ignores one the caller passes", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "created"),
      actorLabel: { kind: "user", name: "Somebody Else" }
    });

    expect(ctx.log[0].actorLabel).toEqual({ kind: "user", name: "Development User" });
  });

  it("names the system actor without a lookup", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, { ...entryBy(userId, "cleaned"), actor: { kind: "system" } });

    expect(ctx.log[0].actorLabel).toEqual({ kind: "system", name: "System" });
  });

  it("refuses an actor it cannot name rather than logging a blank one", async () => {
    const { ctx, scope, userId } = await asking();

    await expect(
      record(asCtx(ctx), scope, {
        ...entryBy(userId, "created"),
        actor: { kind: "agent", taskId: "agentTasks:1" }
      })
    ).rejects.toThrow(/label/i);
  });

  it("scopes what it writes to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, entryBy(userId, "created"));

    expect(ctx.log[0].projectId).toBe(scope.projectId);
  });
});

describe("list", () => {
  it("returns the caller's project's entries, newest first", async () => {
    const { ctx, scope, userId } = await asking();
    await record(asCtx(ctx), scope, entryBy(userId, "created"));
    await record(asCtx(ctx), scope, entryBy(userId, "renamed"));

    const feed = await list(asCtx(ctx), scope);

    expect(feed.map((entry) => entry.verb)).toEqual(["renamed", "created"]);
    expect(feed[0]).toMatchObject({
      actorLabel: { kind: "user", name: "Development User" },
      target: { type: "document", id: "documents:1", label: "Q3 plan" }
    });
  });

  it("omits another project's entry rather than refusing it", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await record(asCtx(ctx), theirs, entryBy(userId, "created"));

    // Not a refusal: answering "forbidden" would confirm the entry exists to
    // someone with no right to know that.
    expect(await list(asCtx(ctx), scope)).toEqual([]);
  });
});
