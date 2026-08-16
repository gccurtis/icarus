import { describe, expect, it } from "vitest";
import { create } from "$slide-decks/api/create/create";
import { rename } from "$slide-decks/api/rename/rename";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf } from "$slide-decks/test/fixture";

describe("rename", () => {
  it("writes the new title, who wrote it, and an entry naming it", async () => {
    const { ctx, scope, userId } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    await rename(asCtx(ctx), scope, id, "Q4 review");

    expect(ctx.rows.get(id)).toMatchObject({
      title: "Q4 review",
      updatedBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "renamed",
      target: { type: "slideDeck", id, label: "Q4 review" }
    });
  });

  it("refuses to rename a deck to nothing, leaving the name it had", async () => {
    const { ctx, scope } = await asking();
    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "   "))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 review" });
    expect(ctx.log).toHaveLength(1);
  });

  it("reports not found for a deck in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const theirs = scopeOf(await projectNamed(ctx, "Theirs"), userId);
    const id = await create(asCtx(ctx), theirs, "Their review", "16:9");

    // Not "forbidden": distinguishing the two confirms the deck exists to
    // someone with no right to know that.
    expect(await refusalFrom(rename(asCtx(ctx), scope, id, "Mine now"))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(id)).toMatchObject({ title: "Their review" });
  });
});
