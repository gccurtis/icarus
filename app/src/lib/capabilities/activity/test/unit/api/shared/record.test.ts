import { describe, expect, it } from "vitest";
import { record } from "$activity/api/shared/record";
import { asCtx, asking, entryBy, taskWith, unwrittenTask } from "$activity/test/fixture";
import type { ActivityEntry } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";

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

  it("names a user whose row is gone", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "created"),
      actor: { kind: "user", userId: "users:404" as Id<"users"> }
    });

    expect(ctx.log[0].actorLabel).toEqual({ kind: "user", name: "A deleted user" });
  });

  it("names the system actor without a lookup", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, { ...entryBy(userId, "cleaned"), actor: { kind: "system" } });

    expect(ctx.log[0].actorLabel).toEqual({ kind: "system", name: "System" });
  });

  it("resolves an agent's label to persona, dispatcher, and task title", async () => {
    const { ctx, scope, userId } = await asking();
    const taskId = await taskWith(ctx, scope.projectId, {
      title: "Q3 competitive scan",
      persona: "Researcher",
      origin: { kind: "user", userId }
    });

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "edited"),
      actor: { kind: "agent", taskId }
    });

    // Rendered in order: *Researcher · Development User · Q3 competitive scan*.
    // Each answers a question the others do not — several tasks run the same
    // persona, and a title alone says nothing about what produced the work.
    expect(ctx.log[0].actorLabel).toEqual({
      kind: "agent",
      name: "Researcher",
      onBehalfOf: "Development User",
      detail: "Q3 competitive scan"
    });
  });

  it("names an agent with no persona, and nobody it acted for", async () => {
    const { ctx, scope, userId } = await asking();
    const taskId = await taskWith(ctx, scope.projectId, {
      title: "Nightly sweep",
      origin: { kind: "system" }
    });

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "edited"),
      actor: { kind: "agent", taskId }
    });

    expect(ctx.log[0].actorLabel).toEqual({
      kind: "agent",
      name: "Agent",
      onBehalfOf: undefined,
      detail: "Nightly sweep"
    });
  });

  it("resolves an agent's label itself and ignores one the caller passes", async () => {
    const { ctx, scope, userId } = await asking();
    const taskId = await taskWith(ctx, scope.projectId, {
      title: "Q3 competitive scan",
      persona: "Researcher",
      origin: { kind: "user", userId }
    });

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "edited"),
      actor: { kind: "agent", taskId },
      actorLabel: { kind: "agent", name: "Something Else", detail: "Another job" }
    });

    expect(ctx.log[0].actorLabel).toMatchObject({ name: "Researcher", detail: "Q3 competitive scan" });
  });

  it("keeps a label it cannot resolve itself", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, {
      ...entryBy(userId, "created"),
      actor: { kind: "agent", taskId: unwrittenTask },
      actorLabel: { kind: "agent", name: "Research agent", onBehalfOf: "Development User" }
    });

    expect(ctx.log[0].actorLabel).toEqual({
      kind: "agent",
      name: "Research agent",
      onBehalfOf: "Development User"
    });
  });

  // The two halves of one guard: nobody supplied a label, and somebody supplied
  // an empty one. Only the second is what a blank byline would actually arrive as.
  it("refuses an actor it cannot name and nobody named", async () => {
    const { ctx, scope, userId } = await asking();

    await expect(
      record(asCtx(ctx), scope, {
        ...entryBy(userId, "created"),
        actor: { kind: "agent", taskId: unwrittenTask }
      })
    ).rejects.toThrow(/label/i);
  });

  it("refuses a label whose name is blank", async () => {
    const { ctx, scope, userId } = await asking();

    await expect(
      record(asCtx(ctx), scope, {
        ...entryBy(userId, "created"),
        actor: { kind: "agent", taskId: unwrittenTask },
        actorLabel: { kind: "agent", name: "" }
      })
    ).rejects.toThrow(/label/i);
  });

  it("scopes what it writes to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();

    await record(asCtx(ctx), scope, entryBy(userId, "created"));

    expect(ctx.log[0].projectId).toBe(scope.projectId);
  });
});
