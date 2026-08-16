import { describe, expect, it } from "vitest";
import { list } from "$activity/api/list/list";
import { record } from "$activity/api/shared/record";
import { asCtx, asking, entryBy, projectNamed, scopeOf } from "$activity/test/fixture";

describe("list", () => {
  it("returns the caller's project's entries, newest first", async () => {
    const { ctx, scope, userId } = await asking();
    await record(asCtx(ctx), scope, entryBy(userId, "created"));
    await record(asCtx(ctx), scope, entryBy(userId, "renamed"));

    const feed = await list(asCtx(ctx), scope);

    expect(feed.map((entry) => entry.verb)).toEqual(["renamed", "created"]);
  });

  it("carries what a feed renders and nothing of the row it read", async () => {
    const { ctx, scope, userId } = await asking();
    await record(asCtx(ctx), scope, entryBy(userId, "renamed"));

    const [entry] = await list(asCtx(ctx), scope);

    expect(entry).toEqual({
      actor: { kind: "user", userId },
      actorLabel: { kind: "user", name: "Development User" },
      verb: "renamed",
      target: { type: "document", id: "documents:1", label: "Q3 plan" },
      context: undefined,
      detail: undefined,
      at: expect.any(Number) as number
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
