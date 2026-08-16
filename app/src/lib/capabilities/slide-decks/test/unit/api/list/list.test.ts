import { describe, expect, it } from "vitest";
import { create } from "$slide-decks/api/create/create";
import { list } from "$slide-decks/api/list/list";
import { asCtx, asking, projectNamed, scopeOf } from "$slide-decks/test/fixture";

describe("list", () => {
  it("returns the caller's project's decks and no other's", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    await create(asCtx(ctx), scope, "Mine", "16:9");
    await create(asCtx(ctx), theirs, "Theirs", "16:9");

    expect((await list(asCtx(ctx), scope)).map((deck) => deck.title)).toEqual(["Mine"]);
  });

  it("carries what a deck list renders, thumbnail shape included", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 review", "4:3");

    const [deck] = await list(asCtx(ctx), scope);

    expect(deck).toEqual({
      id,
      title: "Q3 review",
      aspectRatio: "4:3",
      templateId: undefined,
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: expect.any(Number) as number
    });
  });
});
