import { describe, expect, it } from "vitest";
import { create } from "$documents/api/create/create";
import { list } from "$documents/api/list/list";
import { asCtx, asking, projectNamed, scopeOf } from "$documents/test/fixture";

describe("list", () => {
  it("returns the caller's project's documents and no other's", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await create(asCtx(ctx), scope, "Mine");
    await create(asCtx(ctx), theirs, "Theirs");

    expect((await list(asCtx(ctx), scope)).map((document) => document.title)).toEqual(["Mine"]);
  });

  it("carries what a list renders and nothing of the row it read", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 plan");

    const [document] = await list(asCtx(ctx), scope);

    expect(document).toEqual({
      id,
      title: "Q3 plan",
      templateId: undefined,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: expect.any(Number) as number
    });
  });
});
