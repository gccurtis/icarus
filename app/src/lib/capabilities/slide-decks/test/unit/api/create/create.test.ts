import { describe, expect, it } from "vitest";
import { read } from "$revisions/api/read/read";
import { create } from "$slide-decks/api/create/create";
import { asCtx, asking, refusalFrom } from "$slide-decks/test/fixture";
import { emptySlideDeckBody } from "$slide-decks/types/body";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    expect(ctx.rows.get(id)).toMatchObject({ projectId: scope.projectId, title: "Q3 review" });
  });

  it("attributes the row to the asking user rather than to an argument", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    expect(ctx.rows.get(id)).toMatchObject({
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId }
    });
  });

  it("keeps the shape it is drawn at on the row, where a thumbnail can read it", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 review", "4:3");

    expect(ctx.rows.get(id)).toMatchObject({ aspectRatio: "4:3" });
  });

  it("records the creation in the same transaction", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    expect(ctx.log[0]).toMatchObject({
      projectId: scope.projectId,
      verb: "created",
      target: { type: "slideDeck", id, label: "Q3 review" }
    });
  });

  it("anchors an empty body, so the deck opens before anyone edits it", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "Q3 review", "16:9");

    // `slides`, not `document` — the resource key is the pair, and a deck is
    // read through the same two tables under a different type.
    expect(await read(asCtx(ctx), scope, { resourceType: "slides", resourceId: id })).toEqual({
      revision: 0,
      body: emptySlideDeckBody()
    });
  });

  it("stores the title as it will be read, not as it was typed", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, "  Q3 review  ", "16:9");

    expect(ctx.rows.get(id)).toMatchObject({ title: "Q3 review" });
  });

  it("refuses a deck with no name", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(create(asCtx(ctx), scope, "   ", "16:9"))).toMatchObject({
      code: "empty-title"
    });
    expect(ctx.log).toEqual([]);
  });
});
